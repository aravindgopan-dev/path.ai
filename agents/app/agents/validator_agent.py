"""Validator Agent — deterministic structural comparison of user code against expected spec.

LLM is NOT used here. This is pure logic.
Returns a validation result with a score percentage.
"""

from __future__ import annotations

from typing import Any


def validate_code(
    user_files: list[dict[str, str]],
    expected_spec: dict,
) -> dict[str, Any]:
    """Compare submitted files against expected_spec deterministically.

    Parameters
    ----------
    user_files : list of { "filename": str, "content": str }
    expected_spec : { required_routes, required_functions,
                      required_imports, expected_files, validation_rules }

    Returns
    -------
    { status: "pass" | "fail", missing_items: [...], notes: [...], score: float }
    """
    missing: list[str] = []
    notes: list[str] = []
    total_checks = 0
    passed_checks = 0

    # Merge all user content into a single searchable blob per file
    file_map: dict[str, str] = {}
    for f in user_files:
        name = f.get("filename", "")
        content = f.get("content", "")
        file_map[name] = content

    all_content = "\n".join(file_map.values())

    # 1. Check expected files exist
    for expected_file in expected_spec.get("expected_files", []):
        total_checks += 1
        matched = any(expected_file in name for name in file_map)
        if matched:
            passed_checks += 1
        else:
            missing.append(f"file:{expected_file}")

    # 2. Check required imports
    for imp in expected_spec.get("required_imports", []):
        total_checks += 1
        if imp in all_content:
            passed_checks += 1
        else:
            missing.append(f"import:{imp}")

    # 3. Check required functions / class declarations
    for fn in expected_spec.get("required_functions", []):
        total_checks += 1
        # Look for common declaration patterns
        patterns = [
            f"function {fn}",
            f"def {fn}",
            f"const {fn}",
            f"let {fn}",
            f"var {fn}",
            f"class {fn}",
            f"export function {fn}",
            f"export const {fn}",
            f"export default function {fn}",
            f"async function {fn}",
            f"async def {fn}",
        ]
        found = any(p in all_content for p in patterns)
        if found:
            passed_checks += 1
        else:
            missing.append(f"function:{fn}")

    # 4. Check required routes
    for route in expected_spec.get("required_routes", []):
        total_checks += 1
        # Flexible check — route path string anywhere in code
        if route in all_content:
            passed_checks += 1
        else:
            missing.append(f"route:{route}")

    # 5. Custom validation rules (pattern-match rules with reasons)
    for rule in expected_spec.get("validation_rules", []):
        total_checks += 1
        
        # Handle both old string format and new dict format
        if isinstance(rule, str):
            keyword = rule
            reason = "Pedagogical requirement"
        else:
            keyword = rule.get("contains", "")
            reason = rule.get("reason", "Important for your learning path")

        if keyword and keyword in all_content:
            passed_checks += 1
        elif keyword:
            notes.append(f"Learning Note: '{keyword}' was missing. Hint: {reason}")

    status = "pass" if not missing and not notes else "fail"
    score = round((passed_checks / total_checks * 100) if total_checks > 0 else 0, 1)

    return {
        "status": status,
        "missing_items": missing,
        "notes": notes,
        "score": score,
    }
