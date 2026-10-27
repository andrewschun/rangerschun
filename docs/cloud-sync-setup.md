# Rangers cloud-sync activation (private player records)
 
## GitHub side
The cloud-sync controls and reconciliation code live in the feature branch/PR until coach-side authentication is deployed. They leave existing records unchanged if the server method is unavailable. Once deployed, players use Workout log > Sync my records with their **private submission code**, not their jersey number. The client uploads waiting journal events before restoring records, then reloads the app. The sync is **manual**, not continuous background sync.

## Google-side activation (coach required)
1. Open the private "2027 Etobicoke Rangers 16U — Team Development Records" spreadsheet, then **Extensions > Apps Script**.
2. Confirm that the current script is the one already deployed to Rangers, and back up the existing Apps Script source.
3. Add **google-apps-script/player-records.gs** as a new .gs source file in that bound script. Do not replace any existing functions.
4. Confirm existing server function `verifyPlayer(player,code)` validates the **private submission code server-side** and returns `{verified:true}` only for that player. If the existing function differs, adapt the new method BEFORE deployment; never use `public_player_entry` to authorize reads.
5. In the server's **HTML-service message relay**, add `getMyPlayerRecords` to the allowed method names. The GitHub browser bridge allowlist is already updated in the accompanying PR; both allowlists must match.
6. Deploy a new version of the existing web-app deployment (do not create a new unlinked URL). Ensure the endpoint keeps the existing execution and access restrictions.
7. Test with a designated test account and two separate devices. Check: saving on A, uploading A, restoring on B, editing on B, deleting on A, restoring on B, and rejection of a different player’s code. Do not test with a real minor's records until authentication is verified.

## Safety
- Do **not** change spreadsheet sharing to public or add credentials to GitHub.
- Player jersey verification in the browser is not server authentication.
- Existing local records are retained if a read/upload fails. A successful sync reconciles only the chosen player's records and applies confirmed deletions, with unsent local changes winning.
- Existing Google-backed activity dashboards remain separate.
- The new method does not deploy itself merely by merging a GitHub PR. Until the script is deployed, the cloud-restore button cannot complete.
