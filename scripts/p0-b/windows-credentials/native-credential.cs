using System;
using System.Runtime.InteropServices;
using System.Security;
using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace Dsh861.Credentials
{
    // An OS-user credential backend, not a sandbox against code running as that user.
    public static class NativeCredential
    {
        private const uint Generic = 1;
        private const uint LocalMachinePersistence = 2;
        private const string Marker = "dsh861:ascii-key:v1";
        public const int MaxKeyBytes = 384; // Fits one RSA-4096 OAEP-SHA256 envelope (446 bytes maximum).

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct Credential
        {
            public uint Flags;
            public uint Type;
            public string TargetName;
            public string Comment;
            public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
            public uint CredentialBlobSize;
            public IntPtr CredentialBlob;
            public uint Persist;
            public uint AttributeCount;
            public IntPtr Attributes;
            public string TargetAlias;
            public string UserName;
        }

        [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);
        [DllImport("advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool CredWrite(ref Credential credential, uint flags);
        [DllImport("advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool CredDelete(string target, uint type, uint flags);
        [DllImport("advapi32.dll", EntryPoint = "CredFree")]
        private static extern void CredFree(IntPtr buffer);

        public static string Target(string provider)
        {
            switch (provider)
            {
                case "codex": case "claude-code": case "grok": case "opencode":
                    return "dsh861/providers/" + provider;
                default: throw new InvalidOperationException("CREDENTIAL_TARGET_FORBIDDEN");
            }
        }

        private static void ValidateTarget(string target)
        {
            if (target == null || !Regex.IsMatch(target,
                @"\Adsh861/(providers/(codex|claude-code|grok|opencode)|selftest/[0-9a-f]{32})\z"))
                throw new InvalidOperationException("CREDENTIAL_TARGET_FORBIDDEN");
        }

        private static IntPtr Open(string target)
        {
            ValidateTarget(target);
            IntPtr pointer;
            if (CredRead(target, Generic, 0, out pointer)) return pointer;
            int error = Marshal.GetLastWin32Error();
            if (error == 1168) return IntPtr.Zero;
            throw new InvalidOperationException("CREDENTIAL_STORE_UNAVAILABLE");
        }

        private static Credential Decode(IntPtr pointer)
        {
            return (Credential)Marshal.PtrToStructure(pointer, typeof(Credential));
        }

        private static void Zero(IntPtr pointer, int size)
        {
            if (pointer != IntPtr.Zero) for (int i = 0; i < size; i++) Marshal.WriteByte(pointer, i, 0);
        }

        private static void Release(IntPtr pointer)
        {
            if (pointer == IntPtr.Zero) return;
            try
            {
                Credential credential = Decode(pointer);
                if (credential.CredentialBlobSize <= 2560)
                    Zero(credential.CredentialBlob, (int)credential.CredentialBlobSize);
            }
            finally { CredFree(pointer); }
        }

        public static string Status(string provider)
        {
            return StatusTarget(Target(provider));
        }

        private static string StatusTarget(string target)
        {
            IntPtr pointer = Open(target);
            if (pointer == IntPtr.Zero) return "MISSING";
            try
            {
                Credential credential = Decode(pointer);
                return credential.Type == Generic && credential.UserName == Marker
                    && credential.CredentialBlobSize > 0 && credential.CredentialBlobSize <= MaxKeyBytes
                    && credential.Persist == LocalMachinePersistence
                    ? "PRESENT_NOT_AUTHENTICATED" : "PRESENT_UNSUPPORTED_FORMAT";
            }
            finally { Release(pointer); }
        }

        private static byte[] FromSecureString(SecureString value)
        {
            if (value == null || value.Length < 1 || value.Length > MaxKeyBytes)
                throw new InvalidOperationException("CREDENTIAL_VALUE_INVALID");
            byte[] bytes = new byte[value.Length];
            IntPtr pointer = IntPtr.Zero;
            try
            {
                pointer = Marshal.SecureStringToGlobalAllocUnicode(value);
                for (int i = 0; i < value.Length; i++)
                {
                    int character = (ushort)Marshal.ReadInt16(pointer, i * 2);
                    if (character < 33 || character > 126)
                        throw new InvalidOperationException("CREDENTIAL_VALUE_INVALID");
                    bytes[i] = (byte)character;
                }
                return bytes;
            }
            catch { Array.Clear(bytes, 0, bytes.Length); throw; }
            finally { if (pointer != IntPtr.Zero) Marshal.ZeroFreeGlobalAllocUnicode(pointer); }
        }

        // Explicit replacement is required. Provisioning must be single-writer;
        // CredWrite itself is an upsert and cannot enforce compare-and-swap.
        private static void WriteTarget(string target, byte[] bytes, bool replace)
        {
            if (StatusTarget(target) != "MISSING" && !replace)
                throw new InvalidOperationException("CREDENTIAL_EXISTS_USE_REPLACE");
            IntPtr pointer = Marshal.AllocHGlobal(bytes.Length);
            try
            {
                Marshal.Copy(bytes, 0, pointer, bytes.Length);
                Credential credential = new Credential();
                credential.Type = Generic;
                credential.TargetName = target;
                credential.Comment = "dsh861 dedicated credential; not a rotation or model-authorization receipt";
                credential.CredentialBlobSize = (uint)bytes.Length;
                credential.CredentialBlob = pointer;
                credential.Persist = LocalMachinePersistence;
                credential.UserName = Marker;
                if (!CredWrite(ref credential, 0))
                    throw new InvalidOperationException("CREDENTIAL_STORE_UNAVAILABLE");
            }
            finally { Zero(pointer, bytes.Length); Marshal.FreeHGlobal(pointer); }
        }

        public static void Store(string provider, SecureString value, SecureString confirmation, bool replace)
        {
            byte[] first = null, second = null;
            try
            {
                first = FromSecureString(value);
                second = FromSecureString(confirmation);
                int mismatch = first.Length ^ second.Length;
                for (int i = 0; i < Math.Min(first.Length, second.Length); i++) mismatch |= first[i] ^ second[i];
                if (mismatch != 0) throw new InvalidOperationException("CREDENTIAL_CONFIRMATION_MISMATCH");
                WriteTarget(Target(provider), first, replace);
            }
            finally
            {
                if (first != null) Array.Clear(first, 0, first.Length);
                if (second != null) Array.Clear(second, 0, second.Length);
            }
        }

        private static bool DeleteTarget(string target)
        {
            ValidateTarget(target);
            if (CredDelete(target, Generic, 0)) return true;
            if (Marshal.GetLastWin32Error() == 1168) return false;
            throw new InvalidOperationException("CREDENTIAL_DELETE_FAILED");
        }

        public static bool Remove(string provider) { return DeleteTarget(Target(provider)); }

        private static string SealTarget(string target, string modulus, string exponent)
        {
            byte[] publicModulus = Convert.FromBase64String(modulus);
            byte[] publicExponent = Convert.FromBase64String(exponent);
            if (publicModulus.Length != 512 || (publicModulus[0] & 128) == 0
                || exponent != "AQAB" || publicExponent.Length != 3)
                throw new InvalidOperationException("CREDENTIAL_BRIDGE_REQUEST_INVALID");
            // Validate the public key before reading any credential.
            using (RSACng rsa = new RSACng())
            {
                rsa.ImportParameters(new RSAParameters { Modulus = publicModulus, Exponent = publicExponent });
                IntPtr pointer = Open(target);
                if (pointer == IntPtr.Zero) return null;
                byte[] bytes = null;
                try
                {
                    Credential credential = Decode(pointer);
                    if (credential.Type != Generic || credential.UserName != Marker
                        || credential.Persist != LocalMachinePersistence
                        || credential.CredentialBlobSize < 1 || credential.CredentialBlobSize > MaxKeyBytes)
                        throw new InvalidOperationException("CREDENTIAL_FORMAT_UNSUPPORTED");
                    bytes = new byte[credential.CredentialBlobSize];
                    Marshal.Copy(credential.CredentialBlob, bytes, 0, bytes.Length);
                    foreach (byte value in bytes) if (value < 33 || value > 126)
                        throw new InvalidOperationException("CREDENTIAL_VALUE_INVALID");
                    return Convert.ToBase64String(rsa.Encrypt(bytes, RSAEncryptionPadding.OaepSHA256));
                }
                finally
                {
                    if (bytes != null) Array.Clear(bytes, 0, bytes.Length);
                    Release(pointer);
                }
            }
        }

        // No public plaintext-export operation: stdout carries only an ephemeral ciphertext.
        public static string Seal(string provider, string modulus, string exponent)
        {
            return SealTarget(Target(provider), modulus, exponent);
        }

        public static string SelfTest(string requestId, string modulus, string exponent)
        {
            if (!Regex.IsMatch(requestId ?? "", @"\A[0-9a-f]{32}\z"))
                throw new InvalidOperationException("CREDENTIAL_BRIDGE_REQUEST_INVALID");
            string target = "dsh861/selftest/" + requestId;
            byte[] first = System.Text.Encoding.ASCII.GetBytes("dsh861-synthetic-first-" + requestId);
            byte[] second = System.Text.Encoding.ASCII.GetBytes("dsh861-synthetic-second-" + requestId);
            bool created = false;
            try
            {
                WriteTarget(target, first, false);
                created = true;
                if (StatusTarget(target) != "PRESENT_NOT_AUTHENTICATED")
                    throw new InvalidOperationException("CREDENTIAL_SELFTEST_FAILED");
                bool refused = false;
                try { WriteTarget(target, second, false); }
                catch (InvalidOperationException error)
                {
                    if (error.Message != "CREDENTIAL_EXISTS_USE_REPLACE") throw;
                    refused = true;
                }
                if (!refused) throw new InvalidOperationException("CREDENTIAL_SELFTEST_FAILED");
                WriteTarget(target, second, true);
                return SealTarget(target, modulus, exponent);
            }
            finally
            {
                Array.Clear(first, 0, first.Length);
                Array.Clear(second, 0, second.Length);
                if (created)
                {
                    DeleteTarget(target);
                    if (StatusTarget(target) != "MISSING")
                        throw new InvalidOperationException("CREDENTIAL_SELFTEST_CLEANUP_FAILED");
                }
            }
        }
    }
}
