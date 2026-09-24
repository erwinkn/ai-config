# Skill sources

Provenance for skills that come from another source. The lock file
(`skills-lock.json`) records tool-installed skills. This file covers skills
that were copied or adapted, where the lock file cannot show the origin or the
local changes.

| Skill | Source | Ref | License | Local changes |
| --- | --- | --- | --- | --- |
| code-review | [earendil-works/pi-review](https://github.com/earendil-works/pi-review), `review.ts` | `main`, 2026-09-13 | MIT | Rewrote the `review` command as a skill. Modes, rubric, and handoff live in `references/review.md`; added the `review-context.sh` helper, the cross-family reviewer model default, and the split by domain for very large changes. The rubric also adapts the Codex review prompt. |
| code-review, `references/thermo-nuclear.md` | [cursor/plugins](https://github.com/cursor/plugins), `cursor-team-kit/skills/thermo-nuclear-code-quality-review` | `main`, 2026-09-24 | MIT | Copied the body verbatim with the skill metadata removed. It runs only as the thermo-nuclear mode of `code-review`, so agents cannot invoke it on its own. |
| decision-audit | [cursor/plugins](https://github.com/cursor/plugins), `pstack/skills/show-me-your-work` | `main`, 2026-09-24 | MIT | Kept the local audit and lifted the idea of a TSV decision log written during the work: evidence pointers, append-only rows, and composition with other skills. Added `instead` and `confidence` columns, a diff-based gap check, and the `decision-log.sh` helper. Dropped the transcript audit, run markers, and cross-model trail review. |
| principles | [cursor/plugins](https://github.com/cursor/plugins), `pstack/skills/principle-*` | `main`, 2026-09-13 | MIT | Copied each principle body verbatim to `references/` with the skill metadata removed. `SKILL.md` keeps the index and links each entry. |
| tdd | [cursor/plugins](https://github.com/cursor/plugins), `pstack/skills/tdd` | `main`, 2026-09-13 | MIT | Copied the body verbatim with the skill metadata removed. Dropped the Cursor-specific `disable-model-invocation` flag; the gating stays in the description. |

## License texts

### earendil-works/pi-review

MIT License

Copyright (c) 2026 Earendil Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### cursor/plugins (pstack)

MIT License

Copyright (c) 2026 Lauren Tan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### cursor/plugins (cursor-team-kit)

MIT License

Copyright (c) 2026 Cursor

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
