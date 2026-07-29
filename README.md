# Free AJC Account Tester

This is a FREE AJC Account Tester - it is an unofficial modification of the AJ Classic desktop client that adds account-testing tools directly to the login screen. It is completely free and was created before Strawberry Jam or BerryBreach for my fiance to use. I made a few tweaks to improve it a bit so I could release it.

## Features

- Manually need to login and check the items for each working account.
- Load account lists from a text file.
- Test a selected account or process the complete list.
- Use Actual login mode to log in to the selected account.
- Filter, reload, and clean up tested entries.
- Track working, invalid, pending, and other account states.
- Configure test delays, retry delays, and UUID spoofing.

## Release

The release artifact is `app.asar`. Replace the AJ Classic `resources/app.asar` file with the released archive while the client is closed. Keep a copy of the client's original archive outside this repository if you may need to restore it.

The unpacked source is stored in `app-asar`. To rebuild the release archive:

```powershell
npx asar pack app-asar app.asar
```

## Related Projects

### BerryBreach

[glvckoma/Berry-Breach](https://github.com/glvckoma/Berry-Breach) provides a more in-depth account workflow with detailed account scraping, management, checking, filtering, and result handling.

### Strawberry Jam

[glvckoma/Strawberry-Jam](https://github.com/glvckoma/Strawberry-Jam) is the archived network-analysis and plugin-based companion project. Its account scraping and leak-checking data can be used in broader account-analysis workflows, including BerryBreach.

## License and Usage Restrictions

Glvckoma's original modifications and additions are licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). They may be used, studied, modified, and shared only for noncommercial purposes and subject to the full license terms.

Selling, reselling, renting, relicensing for a fee, monetizing, or including this project in a paid product or service is not permitted. Using this project as the base for a fork, port, substantial rewrite, or other derivative version does not grant permission to sell it. Commercial licensing requires prior written permission from Glvckoma.

Redistributions and derivative versions must preserve the license, the required copyright notice, credit to Glvckoma, and a working link to the original repository. You may describe and claim ownership of your own original additions, but you may not claim Glvckoma's work as your own or remove, hide, or misrepresent its attribution.

The license covers only Glvckoma's original modifications and additions. AJ Classic code, artwork, trademarks, and other third-party material remain the property of their respective owners and are subject to their own terms.

## Responsible Use

Only test accounts that you OWN or are explicitly authorized to access. Automated requests may violate Animal Jam's terms and can result in IP restrictions, account suspension, or permanent account termination. This project is not affiliated with or endorsed by WildWorks or Animal Jam. Use it entirely at your own risk.
