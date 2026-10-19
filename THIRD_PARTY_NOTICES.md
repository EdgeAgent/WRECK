# Third-party notices

WRECK is an original framework that also vendors source snapshots of REA, AI Website Cloner, and the source trees pinned as REA Git submodules. These are included as code (not Git submodules) so a normal WRECK clone contains the source. Their copyright, licenses, and notices remain with the respective files. WRECK does not claim authorship of this code, and the root MIT license does not replace any upstream terms.

## REA — Reverse Engineer Anything

- Upstream: <https://github.com/morluto/rea>
- Included at: `packages/rea/`
- Revision: `255d906e15a141b0f4acee60dc73976f03adc94c`
- License: MIT; see `packages/rea/LICENSE`
- Additional upstream dependency inventory and notices: `packages/rea/THIRD_PARTY_NOTICES.md` and `packages/rea/licenses/`

### REA pinned source submodules

| Included path | Upstream | Included revision | License notice |
|---|---|---|---|
| `packages/rea/third_party/binwalk/` | [ReFirmLabs/binwalk](https://github.com/ReFirmLabs/binwalk) | `4fdab3d464d97b68e0af9088df3f9e2e1545b21c` | MIT; `LICENSE` |
| `packages/rea/third_party/ghidra-nativeaot/` | [Washi1337/ghidra-nativeaot](https://github.com/Washi1337/ghidra-nativeaot) | `effeb734fc570c32650f88b159608979dc7b423e` | MIT; `LICENSE.md` |
| `packages/rea/third_party/jadx-headless-mcp/` | [1013503897/jadx-headless-mcp](https://github.com/1013503897/jadx-headless-mcp) | `5844800a486d2248fa949b74c9896285f5b54de2` | Apache-2.0; `LICENSE` |
| `packages/rea/third_party/unblob/` | [onekey-sec/unblob](https://github.com/onekey-sec/unblob) | `1fcc7a0a584a70a96c31f5a276c20944d199a089` | MIT; `LICENSE` and `NOTICE` |
| `packages/rea/third_party/wakaru/` | [pionxzh/wakaru](https://github.com/pionxzh/wakaru) | `8219bf5016a063d7fb215101a8c45d5959ec733f` | Apache-2.0; `LICENSE` |

Each submodule tree was initialized from the exact commit pinned by REA, then included in WRECK as ordinary files. The original `packages/rea/.gitmodules` remains as provenance metadata; WRECK does not rely on it for checkout.

## AI Website Cloner Template

- Upstream: <https://github.com/JCodesMore/ai-website-cloner-template>
- Included at: `apps/website-cloner/`
- Revision: `ee3f5a2f31fd549b9593fa4f7cf6d2955ee593bb`
- License: MIT; see `apps/website-cloner/LICENSE`
- The upstream's agent skill, Next.js template, documentation, and notices are preserved.

## WRECK-authored framework

The runtime and framework code under `src/`, the tests under `test/`, and WRECK-specific documentation are authored for this repository and licensed under the root MIT license. Changes to upstream source files remain subject to their original licenses and attribution; check each included notice before distributing or modifying those files.

## WRECK visual assets

- `docs/assets/wreck-icon.png` and `docs/assets/wreck-hero.png` were generated for this repository as WRECK branding assets; they are not copied from REA or the website cloner. No upstream license is asserted for these generated images; review applicable platform terms before separate commercial redistribution.
- `docs/assets/wreck-pipeline.png` is a rendered diagram generated from the WRECK-authored source `docs/wreck-pipeline.mmd`.
