/**
 * RANGERS APP SCRIPT ADD-ON — add to the EXISTING, bound Apps Script project.
 * Do NOT replace existing doGet, verifyPlayer, writeJournal or HTML bridge.
 * This must remain server-side; never expose the Entries sheet to web viewers.
 *
 * Requires the existing verifyPlayer(player,code) to return {verified:true}
 * only for the player whose coach-issued private submission code matches.
 * Public/no-code submission must NOT bypass this read gate.
 */
function getMyPlayerRecords(request) {
  if (!request || typeof request.player !== 'string' || typeof request.code !== 'string' ||
      !request.player || request.player.length > 100 || request.code.length < 6 || request.code.length > 100) {
    throw new Error('Choose a player and enter the private coach-issued code.');
  }
  var verified = verifyPlayer(request.player, request.code);
  if (!verified || verified.verified !== true) throw new Error('Player record access was not confirmed.');
  var book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('The Rangers coach spreadsheet is not connected.');
  var sheet = book.getSheetByName('Entries');
  if (!sheet) throw new Error('The Entries tab is missing.');
  var last = sheet.getLastRow();
  if (last < 2) return {version:1,player:request.player,events:[]};
  var rows = sheet.getRange(1,1,last,37).getValues();
  var fields = rows[0].map(String);
  var byName = {};
  fields.forEach(function(name,i){byName[name]=i;});
  ['event_id','received_at','entry_type','operation','record_id','player','record_json_1','record_json_2','record_json_3'].forEach(function(key){
    if (!Object.prototype.hasOwnProperty.call(byName,key)) throw new Error('The Entries columns are not configured for cloud restore.');
  });
  var kinds = {blast:true,blast_pcr:true,baseball:true,workout:true,overspeed:true,overspeed_session:true,pulse:true};
  var events = [];
  rows.slice(1).forEach(function(row) {
    if (row[byName.player] !== request.player) return;
    var kind = row[byName.entry_type],operation = row[byName.operation];
    if (!kinds[kind] || (operation !== 'save' && operation !== 'delete')) throw new Error('Invalid coach entry type.');
    var json = String(row[byName.record_json_1]||'')+String(row[byName.record_json_2]||'')+String(row[byName.record_json_3]||'');
    var record;
    try { record=JSON.parse(json); } catch (e) { throw new Error('Unreadable coach entry.'); }
    if (!record || record.player !== request.player || record.id !== row[byName.record_id]) throw new Error('Coach entry identity mismatch.');
    var date=row[byName.received_at];
    var received=(date instanceof Date)?date.toISOString():String(date||'');
    if(!received)throw new Error('An entry is missing its receipt time.');
    events.push({event_id:String(row[byName.event_id]),received_at:received,kind:kind,operation:operation,player:request.player,record:record});
    if(events.length>3500)throw new Error('Cloud history too large for one restore. Ask the coach to archive old entries first.');
  });
  return {version:1,player:request.player,events:events};
}
/*
 * ALSO update the existing Google HTML relay allowlist to include
 * 'getMyPlayerRecords', and deploy a NEW version of the web app.
 * See docs/cloud-sync-setup.md for the complete steps.
 */
