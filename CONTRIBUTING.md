# Contributing to terminalfour-js

Contributions are welcome from anyone.

This project is **open code, not open source**. It is licensed under the
[Elastic License 2.0](./LICENSE.md), which lets you use, copy, modify, and
distribute the SDK, but not offer it to third parties as a hosted or managed
service. Read the licence before you start.

All contributions require a signed [CLA](./CLA.md).

## Getting Set Up

```bash
npm ci          # install dependencies
npm run build   # compile ESM + CJS to dist/
npm test        # run the vitest suite
```

Both `npm run build` and `npm test` must pass before you open a merge request.

## Reporting a Bug or Proposing a Change

Search existing issues first. Then open an issue with:

- What you expected, and what actually happened.
- Steps to reproduce.
- SDK version, Node version, and Terminalfour version.

**Security vulnerabilities do not go in issues** — see [SECURITY.md](./SECURITY.md).

For anything non-trivial, open an issue before writing code so the approach can
be agreed first.

## Submitting Changes

1. Keep each merge request to a single logical change.
2. Add or update tests. Update the relevant file in `docs/` if behaviour changes.
3. Match the existing code style. No unrelated reformatting or refactoring.
4. Explain what changed and why in the description.
5. Disclose any new dependency and any AI assistance (see below).

Maintainers may accept, request changes to, or decline any contribution. There
is no guaranteed review timeframe.

## Dependencies

This SDK ships with **zero runtime dependencies**. Keep it that way unless there
is a strong reason not to — a new runtime dependency needs maintainer approval
before it is merged, and must be disclosed in the merge request.

Do not paste third-party source into the repository, and do not remove or alter
third-party licence notices.

## AI-Assisted Contributions

Using AI tools is allowed. **Disclosing it is mandatory.** Add a trailer to your
commit message or merge request description:

```
AI-Assisted: yes
AI-Tools: <tool name>
```

Disclose when AI output lands in the contribution — generated code, a drafted
doc section, an AI-proposed change you applied. You do not need to disclose
operational use such as having a tool explain code or run tests. When in doubt,
disclose.

You are the author regardless of the tools used. You must have reviewed and
understood everything you submit, be able to answer questions about it in
review, and remain responsible for it — including that it does not infringe
third-party rights. "The AI generated it" is not a defence for a defect.

Non-disclosure may result in the contribution being rejected and, if repeated,
loss of access to project spaces (see [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)).

## Never Include

Do not put any of the following in an issue, merge request, commit, or comment:

- Customer or personal data.
- Credentials, API keys, tokens, private keys, or passwords.
- Production logs containing sensitive data.
- Confidential Terminalfour, client, or partner information.

If you are unsure whether something is confidential, ask before including it.

## Contributor Licence Agreement

Contributions can only be merged once you have signed the [CLA](./CLA.md). It
grants Terminalfour the rights needed to ship your contribution, including in
commercial products, while you keep full ownership of your own work. You sign
once per account.

## Questions

terminalfour-sdk@terminalfour.com
