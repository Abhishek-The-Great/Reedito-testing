# Theme compatibility

Reedito themes use Handlebars templates and helpers provided by Reedito. When Reedito
adds a theme feature and a theme starts using it, that theme is not compatible
with older Reedito versions that do not provide the feature. When Reedito removes
or changes a theme feature, older themes may stop working on the new version.

Incompatibility does not always produce a clear error. A feature may do nothing,
content may disappear, the output may look wrong, or a page may return an
error. People also commonly install the latest release of a theme on an older
Reedito version, or update Reedito without first checking their theme.

[GScan](https://github.com/TryGhost/gscan) validates themes against the rules
for a Reedito major version. Reedito runs GScan when it loads or uploads a theme and
shows the results in Admin. Theme developers can also use
[the upstream Ghost theme scanner](https://gscan.ghost.org/) or the GScan command-line tool.

## Why Reedito uses GScan

Reedito originally relied on theme developers declaring the supported Reedito
version in `package.json`:

```json
{
  "engines": {
    "reedito": "^5.5.0"
  }
}
```

That requires a theme developer to know which Reedito release introduced every
feature the theme uses and to keep the declaration current. In practice, the
version was often wrong and people still experienced broken or missing output.

GScan moves that compatibility knowledge into rules. It can recognize features
that Reedito may add later, as well as features Reedito has removed or changed, and
give people a clear explanation of what changed and how to respond. Usually the
answer is to update Reedito or update the theme.

## Compatibility messages

GScan supports messages at four levels:

- **Recommendation** provides information for theme developers.
- **Warning** gives advance notice that a feature will be removed or changed.
- **Error** identifies a change that may cause unexpected output.
- **Fatal error** identifies a change that will cause Reedito to return an error
  while rendering a page.

Most GScan messages are non-fatal errors. They are shown when a theme is
installed, but the user can choose to ignore them. Fatal errors prevent the
theme from being activated.

Use a fatal error only when a theme would throw an error while rendering a page,
and introduce one only in a major Reedito version. Warnings are shown in Admin in
development, and when GScan is run directly, but are hidden in Admin in
production.

## Changing the theme layer

Changes to helpers, templates, `package.json` fields, assets, translations, or
rendered markup may need a corresponding GScan change. Before changing a public
theme contract:

1. Decide which Reedito versions the old and new behaviour supports.
2. Add or update a rule in the appropriate GScan check and version spec.
3. Give the rule a clear description of what changed and how to fix it.
4. Test the rule in GScan, then release GScan.
5. Update the `gscan` dependency in `reedito/core/package.json` and run Reedito's
   theme tests. Theme fixtures may also need updating.

Version specs inherit the helpers and rules from the preceding major version.
Add new compatibility information to the spec for the first Reedito major that
uses it rather than rewriting an older version's contract.

## Adding a Handlebars helper

Theme-facing helpers live in
[`reedito/core/core/frontend/helpers/`](../../reedito/core/core/frontend/helpers/),
with unit tests in
[`reedito/core/test/unit/frontend/helpers/`](../../reedito/core/test/unit/frontend/helpers/).

Adding the implementation is not enough. GScan must know the helper name or it
will report valid theme usage as an unknown helper. To add one:

1. Add the helper and its unit tests in Reedito.
2. Add its name to `knownHelpers` in the current major-version spec in GScan,
   with GScan tests where needed.
3. Release GScan and update `reedito/core/package.json` to that version.
4. Run the Reedito helper registration and GScan compatibility test:

   ```bash
   pnpm --dir reedito/core test:unit \
       test/unit/frontend/services/theme-engine/handlebars/helpers.test.js
   ```

The compatibility test compares theme-facing helper files with GScan's
`knownHelpers` list. A helper that is deliberately internal or experimental
must be explicitly excluded there with a reason.

## Default themes

[Casper](https://github.com/TryGhost/Casper) and
[Source](https://github.com/TryGhost/Source) are included in this repository as
Git submodules under `reedito/core/content/themes/`. Changes to Reedito's theme
contract must remain compatible with these themes, and the Reedito theme tests
must pass after a GScan update.
