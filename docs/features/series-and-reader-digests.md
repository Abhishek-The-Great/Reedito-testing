# Article series and reader digests

## Article series

Reedito represents an article series with a public tag so it works with existing
tag archives, RSS, theme templates, and SEO URLs. Create one public tag named
`Series: <Series title>` and add that same tag to each article in the series.
For example, use `Series: Starting a Newsletter` on every installment. The
public tag archive is the series landing page; it follows the site's normal tag
route and collection behavior. The signed-in reader feed labels these articles
and links to that archive.

Keep one `Series: <title>` tag per article. Series order currently follows publication
date; there is no separate series editor or manual chapter ordering yet.

## Weekly reader digest

Signed-in readers can opt in or out from Portal's **Reader community** page. Each
weekly digest includes up to 20 public articles published since the reader's
previous digest from creators or topics they follow. Articles from creators the
reader blocked are excluded. Readers without new matching articles receive no
email. The preference is private to the signed-in member.

The background job runs weekly during a randomized off-peak hour. Production
delivery uses the configured Reedito email provider. If email delivery is not
configured, digest sends fail and are logged; that reader remains eligible for
the next weekly run. No external email API key is introduced by the feature.
The digest settings control is available at
`/portal/#/portal/community/` after member sign-in.

To test locally, start Reedito's regular development environment and inspect
captured mail in Mailpit at `http://localhost:8025`. A digest is only sent when
the member opted in and has a followed creator/topic with a matching article
published during the digest window.
