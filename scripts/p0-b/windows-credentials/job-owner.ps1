# Owner-scoped Windows job object holder for one planner invocation.
# Protocol: one JSON request per stdin line, exactly one JSON reply per request
# on stdout. The job is created without JOB_OBJECT_LIMIT_BREAKAWAY_OK and
# without JOB_OBJECT_LIMIT_SILENT_BREAKAWAY_OK, so every process a member
# creates joins the job and an explicit CREATE_BREAKAWAY_FROM_JOB spawn stays
# inside it. Stdin EOF (owner process death), the dispose reply and helper
# termination all first call TerminateJobObject and then close the handle,
# whose JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE is the backstop layer. Only the
# exact PID named by the assign request is ever opened; no process is
# enumerated or signalled globally.
$ErrorActionPreference = 'Stop'
$src = @'
using System;
using System.Runtime.InteropServices;
public static class DshJobInterop {
  [StructLayout(LayoutKind.Sequential)]
  public struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
    public long PerProcessUserTimeLimit; public long PerJobUserTimeLimit; public uint LimitFlags;
    public UIntPtr MinimumWorkingSetSize; public UIntPtr MaximumWorkingSetSize; public uint ActiveProcessLimit;
    public UIntPtr Affinity; public uint PriorityClass; public uint SchedulingClass;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct IO_COUNTERS {
    public UIntPtr ReadOperationCount; public UIntPtr WriteOperationCount; public UIntPtr OtherOperationCount;
    public UIntPtr ReadTransferCount; public UIntPtr WriteTransferCount; public UIntPtr OtherTransferCount;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
    public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation; public IO_COUNTERS IoInfo;
    public UIntPtr ProcessMemoryLimit; public UIntPtr JobMemoryLimit; public UIntPtr PeakProcessMemoryUsed; public UIntPtr PeakJobMemoryUsed;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct JOBOBJECT_BASIC_ACCOUNTING_INFORMATION {
    public long TotalUserTime; public long TotalKernelTime; public long ThisPeriodTotalUserTime; public long ThisPeriodTotalKernelTime;
    public uint TotalPageFaultCount; public uint TotalProcesses; public uint ActiveProcesses; public uint TotalTerminatedProcesses;
  }
  [DllImport("kernel32.dll", SetLastError = true)] public static extern IntPtr CreateJobObjectW(IntPtr name, IntPtr attributes);
  [DllImport("kernel32.dll", SetLastError = true)] public static extern bool SetInformationJobObject(IntPtr job, int informationClass, ref JOBOBJECT_EXTENDED_LIMIT_INFORMATION information, int size);
  [DllImport("kernel32.dll", SetLastError = true)] public static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll", SetLastError = true)] public static extern bool TerminateJobObject(IntPtr job, uint exitCode);
  [DllImport("kernel32.dll", SetLastError = true)] public static extern bool QueryInformationJobObject(IntPtr job, int informationClass, out JOBOBJECT_BASIC_ACCOUNTING_INFORMATION information, int size, IntPtr returnLength);
  [DllImport("kernel32.dll", SetLastError = true)] public static extern IntPtr OpenProcess(uint desiredAccess, bool inheritHandle, int processId);
  [DllImport("kernel32.dll", SetLastError = true)] public static extern bool CloseHandle(IntPtr handle);
}
'@
Add-Type -TypeDefinition $src

$JobObjectExtendedLimitInformation = 9
$JobObjectBasicAccountingInformation = 1
$JobObjectLimitKillOnJobClose = 0x2000
$ProcessSetQuota = 0x0100
$ProcessTerminate = 0x0001
$job = [IntPtr]::Zero

function Reply([hashtable] $object) {
  [Console]::Out.WriteLine(($object | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
}

function Ensure-Job {
  if ($script:job -ne [IntPtr]::Zero) { return $true }
  $handle = [DshJobInterop]::CreateJobObjectW([IntPtr]::Zero, [IntPtr]::Zero)
  if ($handle -eq [IntPtr]::Zero) { return $false }
  # Build the nested basic block in its own local first: assigning a nested
  # value-type field directly through PowerShell is a silent no-op on a copy.
  $basic = New-Object DshJobInterop+JOBOBJECT_BASIC_LIMIT_INFORMATION
  $basic.LimitFlags = $JobObjectLimitKillOnJobClose
  $information = New-Object DshJobInterop+JOBOBJECT_EXTENDED_LIMIT_INFORMATION
  $information.BasicLimitInformation = $basic
  $size = [Runtime.InteropServices.Marshal]::SizeOf($information)
  if (-not [DshJobInterop]::SetInformationJobObject($handle, $JobObjectExtendedLimitInformation, [ref]$information, $size)) {
    [DshJobInterop]::CloseHandle($handle) | Out-Null
    return $false
  }
  $script:job = $handle
  return $true
}

function Close-Owned-Job {
  if ($script:job -eq [IntPtr]::Zero) { return }
  # Explicit termination first: fail-safe never depends on the close flag alone.
  [DshJobInterop]::TerminateJobObject($script:job, 1) | Out-Null
  [DshJobInterop]::CloseHandle($script:job) | Out-Null
  $script:job = [IntPtr]::Zero
}

try {
  while ($true) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line) { break }
    if ($line.Trim().Length -eq 0) { continue }
    try { $request = $line | ConvertFrom-Json } catch { Reply @{ ok = $false; code = 'OWNER_PROTOCOL_INVALID' }; continue }
    $operation = $request.op
    if ($operation -eq 'assign') {
      $targetPid = 0
      if (-not [int]::TryParse([string]$request.pid, [ref]$targetPid) -or $targetPid -le 0) {
        Reply @{ ok = $false; code = 'OWNER_PID_INVALID' }
      } elseif (-not (Ensure-Job)) {
        Reply @{ ok = $false; code = 'OWNER_JOB_CREATE_FAILED' }
      } else {
        $process = [DshJobInterop]::OpenProcess($ProcessSetQuota -bor $ProcessTerminate, $false, $targetPid)
        if ($process -eq [IntPtr]::Zero) {
          Reply @{ ok = $false; code = 'OWNER_PROCESS_UNREACHABLE' }
        } else {
          $assigned = [DshJobInterop]::AssignProcessToJobObject($script:job, $process)
          [DshJobInterop]::CloseHandle($process) | Out-Null
          if ($assigned) { Reply @{ ok = $true; assigned = $true } }
          else { Reply @{ ok = $false; code = 'OWNER_ASSIGN_FAILED' } }
        }
      }
    } elseif ($operation -eq 'terminate') {
      if ($script:job -eq [IntPtr]::Zero) {
        Reply @{ ok = $false; code = 'OWNER_NO_JOB' }
      } else {
        $terminated = [DshJobInterop]::TerminateJobObject($script:job, 1)
        if ($terminated) { Reply @{ ok = $true; terminated = $true } }
        else { Reply @{ ok = $false; code = 'OWNER_TERMINATE_FAILED' } }
      }
    } elseif ($operation -eq 'status') {
      if ($script:job -eq [IntPtr]::Zero) {
        Reply @{ ok = $true; created = $false; active = 0 }
      } else {
        $accounting = New-Object DshJobInterop+JOBOBJECT_BASIC_ACCOUNTING_INFORMATION
        $size = [Runtime.InteropServices.Marshal]::SizeOf($accounting)
        $queried = [DshJobInterop]::QueryInformationJobObject($script:job, $JobObjectBasicAccountingInformation, [ref]$accounting, $size, [IntPtr]::Zero)
        if ($queried) { Reply @{ ok = $true; created = $true; active = [int]$accounting.ActiveProcesses } }
        else { Reply @{ ok = $false; code = 'OWNER_STATUS_FAILED' } }
      }
    } elseif ($operation -eq 'dispose') {
      Close-Owned-Job
      Reply @{ ok = $true; disposed = $true }
      exit 0
    } else {
      Reply @{ ok = $false; code = 'OWNER_OP_UNKNOWN' }
    }
  }
} catch {
  exit 1
} finally {
  # Owner death (stdin EOF) or helper crash: terminate every member, then close.
  Close-Owned-Job
}
exit 0
