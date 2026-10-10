# Legacy export fixtures

The JSON files in this directory are historical Ghost content exports. They
exercise Reedito's import and compatibility paths. Their original product names,
URLs, schema fields, and content are test data and should stay faithful to the
source exports rather than being mechanically rebranded.

When adding a fixture, use a sanitized upstream Ghost export, remove personal
data and credentials, document the source version, and add or update an import
test that covers the compatibility behavior. Do not generate a fixture from a
nonexistent Reedito release or include private production data.
