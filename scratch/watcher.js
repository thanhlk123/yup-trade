const fs = require('fs');
const path = require('path');

const localFile = path.join(__dirname, 'discuss.md');
const remoteFile = path.join(__dirname, '../../ai-debate/discuss.md');

if (!fs.existsSync(localFile)) {
    fs.writeFileSync(localFile, '# AI Discussion Room\n\n', 'utf8');
}

console.log(`[V6] Polling files with 15s DEBOUNCE and ROBUST Speaker Detection...`);

function getLastSpeaker(content) {
    const lines = content.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        // Robust check: just needs to start with the name, ignoring roles in parentheses
        if (line.startsWith('**User') || line.startsWith('**Agent A')) return 'User';
        if (line.startsWith('**Agent B')) return 'Agent B';
        if (line.startsWith('**Antigravity')) return 'Antigravity';
    }
    return '';
}

let lastLocalContent = fs.readFileSync(localFile, 'utf8');
let lastRemoteContent = fs.existsSync(remoteFile) ? fs.readFileSync(remoteFile, 'utf8') : '';

let triggerTimeout = null;

function triggerIDE(speaker) {
    console.log(`\n======================================================`);
    console.log(`[EVENT] discuss.md updated by ${speaker}!`);
    console.log(`[ACTION_REQUIRED] Antigravity, please append your reply in 'discuss.md', and then RESTART watcher.js in the background!`);
    console.log(`======================================================\n`);
    process.exit(0);
}

setInterval(() => {
    try {
        // Sync remote -> local
        if (fs.existsSync(remoteFile)) {
            const remoteContent = fs.readFileSync(remoteFile, 'utf8');
            if (remoteContent !== lastRemoteContent) {
                lastRemoteContent = remoteContent;
                if (getLastSpeaker(remoteContent) === 'Agent B') {
                    console.log(`\n[SYNC] Agent B spoke in ai-debate! Syncing to local...`);
                    fs.writeFileSync(localFile, remoteContent, 'utf8');
                }
            }
        }

        // Check local for trigger
        const localContent = fs.readFileSync(localFile, 'utf8');
        if (localContent !== lastLocalContent) {
            lastLocalContent = localContent;
            const lastSpeaker = getLastSpeaker(localContent);
            
            if (lastSpeaker === 'User' || lastSpeaker === 'Agent B') {
                console.log(`\n[DETECTED] Change from ${lastSpeaker}. Waiting 15 seconds to ensure you're done typing/accepting...`);
                
                if (triggerTimeout) clearTimeout(triggerTimeout);
                
                triggerTimeout = setTimeout(() => {
                    triggerIDE(lastSpeaker);
                }, 15000); // 15s debounce delay
            }
        }
    } catch (e) {
        console.error(e.message);
    }
}, 500);
