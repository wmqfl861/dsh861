# r44-B model variant metadata verification: zhipuai-coding-plan/glm-5.3 (2026-09-18)

Authority: PR #13 issuecomment 5724697192 section D. Four layers distinguished: CLI syntax / effective model variant / mapping to provider options / actual request acceptance. No auth.json, no keys, no global-config secrets, no full environment, no user .env was read. The global config file was listed (existence only) and never opened.

## Sources used (in the sanctioned priority order)

1. Existing non-secret metadata: readiness-raw/opencode-models-zhipuai-coding-plan.log (2026-09-17) lists zhipuai-coding-plan/glm-5.3 among ten provider models (ids only, no variant data).
2. Installed-program implementation, read-only: printable-string extraction from the actual exe (opencode-ai@1.18.31, sha256 0242a0dc...440):
   - Embedded catalog entry for provider zhipuai-coding-plan, model glm-5.3: reasoning:true, reasoning_options:[{type:"effort",values:["low","high","max"]}], interleaved:{field:"reasoning_content"}; provider npm package @ai-sdk/openai-compatible, public api base https://open.bigmodel.cn/api/coding/paas/v4, env var name ZHIPU_API_KEY (name only; no value).
   - Compiled variant builder: model.reasoning_options with an effort option yields variants built from its values via a per-provider mapping function; for npm @ai-sdk/openai-compatible that function maps an effort value V to {reasoningEffort:V}. (The separately present hardcoded glm-5.2-only branches and the glm-without-5.2 early empty return are fallbacks that do not apply once reasoning_options declares effort values, as glm-5.3 does.)
3. One supported metadata command, no --refresh, no inference: argv [opencode.exe, models, --verbose, zhipuai-coding-plan], exit=0, stdout 3234 bytes (sha256 543543c449b9234e6a5f91c055fa5be6c4046cd2a9c5ec8eb1ea3cedecbe401f), stderr empty. Raw kept outside the repo, unfiltered full text NOT echoed or stored in the repo. Whitelist-filtered extraction for the target model: id glm-5.3, name GLM-5.3, reasoning true, variants { low: {reasoningEffort: low}, high: {reasoningEffort: high}, max: {reasoningEffort: max} }. Filtered files: r44b5-evidence/cli-models-verbose-filtered.json, cli-models-verbose-glm53-variants.txt (write-then-readback verified).

## Conclusion

- CLI_OPTION_SUPPORTED (record 41).
- MAX_MAPPING_PROVEN at the first three layers: the runtime-merged local model object for zhipuai-coding-plan/glm-5.3 exposes a real max variant, and its mapping is the non-empty provider option {reasoningEffort:"max"} (openai-compatible reasoningEffort request option), proven independently by both the runtime metadata output and the installed binary implementation. No empty variant was created, no default guessed, no stdout self-description relied on, no provider/endpoint/model changed.
- Layer 4 (provider actually accepting the option) is validated only by the authorized Phase-E review call with --variant max in argv; it cannot be pre-declared.
