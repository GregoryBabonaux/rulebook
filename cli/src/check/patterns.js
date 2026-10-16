export const RULE_PATTERNS = [
  /\b(throw|raise)\b/,
  /\babort(_if|_unless)?\s*\(/,
  /\b\w*(ValidationException|AuthorizationException|PermissionDenied|Forbidden|Unauthorized)\b/,
  /->authorize\(|\bGate::|@PreAuthorize|\bauthorize!?\(/,
  /['"](required|nullable|unique|exists|min:\d+|max:\d+|between:)/,
  /\bCHECK\s*\(|\bUNIQUE\b|->unique\(|unique\s*=\s*True/,
];

export const TEST_PATH = /(^|\/)(tests?|specs?|__tests__)\/|\.(test|spec)\.[a-z]+$|_test\.(go|py)$|Test\.php$/;

const COMMENT = /^(\/\/|#|\*|\/\*|--)/;

export function isRuleBearing(line) {
  const code = line.trim();
  if (!code || COMMENT.test(code)) return false;
  return RULE_PATTERNS.some((re) => re.test(code));
}
