'use strict';

// ── CONFIG CHAT ───────────────────────────────────────────────────────
const CHAT_ADMIN_CODE = 'CHPG2026ADMIN';
const CHAT_API_URL = 'https://script.google.com/macros/s/AKfycbyvmAM4y2iPtDjAq-269VHeS2L-fMM9HxCiCLinnGCh9rtRcdSzd1ibLl3EY-ZLmrPqMQ/exec';

// ── STATE ─────────────────────────────────────────────────────────────
let chatAuthenticated = false;
let chatHistory = []; // {role, content, time, applied}
let pendingModification = null; // modification en attente de confirmation

// ── INIT ──────────────────────────────────────────────────────────────
function initChat() {
  const btn = document.getElementById('chatBtn');
  if (btn) btn.onclick = toggleChat;

  const sendBtn = document.getElementById('chatSend');
  if (sendBtn) sendBtn.onclick = sendChatMessage;

  const input = document.getElementById('chatInput');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
  }

  const closeBtn = document.getElementById('chatClose');
  if (closeBtn) closeBtn.onclick = () => {
    document.getElementById('chatPanel').classList.remove('open');
  };

  const authBtn = document.getElementById('chatAuthBtn');
  if (authBtn) authBtn.onclick = authenticateChat;

  const authInput = document.getElementById('chatAuthInput');
  if (authInput) {
    authInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') authenticateChat();
    });
  }
}

function toggleChat() {
  const panel = document.getElementById('chatPanel');
  panel.classList.toggle('open');
  if (panel.classList.contains('open') && !chatAuthenticated) {
    document.getElementById('chatAuthInput').focus();
  } else if (chatAuthenticated) {
    document.getElementById('chatInput').focus();
  }
}

// ── AUTH ──────────────────────────────────────────────────────────────
function authenticateChat() {
  const code = document.getElementById('chatAuthInput').value.trim().toUpperCase();
  if (code === CHAT_ADMIN_CODE) {
    chatAuthenticated = true;
    document.getElementById('chatAuthScreen').style.display = 'none';
    document.getElementById('chatMainScreen').style.display = 'flex';
    document.getElementById('chatInput').focus();
    addBotMessage('Bonjour. Je suis l\'assistant planning du CHPG Monaco.\n\nJe peux modifier les affectations secteur et les règles ponctuelles du planning. Que souhaitez-vous modifier ?');
  } else {
    document.getElementById('chatAuthError').style.display = 'block';
  }
}

// ── MESSAGES ──────────────────────────────────────────────────────────
function addBotMessage(text, type = 'normal') {
  const msg = {
    role: 'assistant',
    content: text,
    time: new Date().toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}),
    type,
  };
  chatHistory.push(msg);
  renderChatHistory();
}

function addUserMessage(text) {
  const msg = {
    role: 'user',
    content: text,
    time: new Date().toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}),
  };
  chatHistory.push(msg);
  renderChatHistory();
}

function renderChatHistory() {
  const container = document.getElementById('chatMessages');
  container.innerHTML = chatHistory.map(msg => {
    if (msg.role === 'user') {
      return `<div class="chat-msg chat-msg-user">
        <div class="chat-msg-text">${escHtml(msg.content)}</div>
        <div class="chat-msg-time">${msg.time}</div>
      </div>`;
    } else {
      const cls = msg.type === 'success' ? 'chat-msg-bot chat-msg-success'
                : msg.type === 'confirm' ? 'chat-msg-bot chat-msg-confirm'
                : 'chat-msg-bot';
      return `<div class="chat-msg ${cls}">
        <div class="chat-msg-text">${escHtml(msg.content)}</div>
        <div class="chat-msg-time">${msg.time}</div>
        ${msg.type === 'confirm' ? `
          <div class="chat-confirm-btns">
            <button class="chat-confirm-yes" onclick="confirmModification()">✅ Confirmer</button>
            <button class="chat-confirm-no" onclick="cancelModification()">✕ Annuler</button>
          </div>` : ''}
        ${msg.applied ? '<div class="chat-applied">✅ Appliqué</div>' : ''}
      </div>`;
    }
  }).join('');

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
  updateModifSummary();
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

// ── SEND MESSAGE ──────────────────────────────────────────────────────
async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  addUserMessage(text);
  document.getElementById('chatTyping').style.display = 'block';

  try {
    const response = await callClaudeAPI(text);
    document.getElementById('chatTyping').style.display = 'none';
    handleClaudeResponse(response);
  } catch (e) {
    document.getElementById('chatTyping').style.display = 'none';
    addBotMessage('❌ Erreur de connexion. Réessayez dans quelques secondes.');
  }
}

// ── CLAUDE API ────────────────────────────────────────────────────────
async function callClaudeAPI(userMessage) {
  // Contexte du planning courant
  const month = DATA?.months?.find(m => m.id === currentMonthId);
  const planningContext = month ? `Mois affiché: ${month.label}` : '';

  const systemPrompt = `Tu es l'assistant planning du service d'Anesthésie-Réanimation du CHPG Monaco.
Tu aides le comité de direction à modifier le planning hebdomadaire.

MÉDECINS ET INITIALES:
BP=PRUNET, SA=ALBOUY, GA=ARMANDO, LB=BONNET, MB=BOUREGBA, JC=CATINEAU, 
AFR=FROHLICH, AF=FERRIERO, SG=GHIGLIONE, JPG=GUERIN, LUL=LEVASSEUR, 
LL=LEY, RM=MENADE, NO=OPPRECHT, NP=PARTOUCHE, GR=ROUSSEAU, CS=SUPLY, 
MS=SEVERAC, WS=SULTAN, DT=TRAN, FZ=ZAMARON, RW=WIDEHEM, NS=SALA

SECTEURS: VIS=Bloc viscéral, REA=Réanimation, ORT=Orthopédie, DVI=Pose DVI,
ORL=ORL/Ophtalmo, END=Endoscopies, CI=Cardio interventionnelle, 
RI=Radio interventionnelle, MAT=Maternité, CS=Consultation

CODES GSHEET: G=Garde, G2=Garde Mater, RG=Repos garde, 18=18h, 
A=Absent, CP=Congé paternité, F=Formation, R=Récup samedi

${planningContext}

Quand l'utilisateur demande une modification:
1. Analyse la demande
2. Identifie: le médecin (ID), la date (YYYY-MM-DD), le secteur matin (code), le secteur après-midi (code)
3. Réponds en JSON structuré dans une balise <modification> comme ceci:

<modification>
{
  "type": "affectation_secteur" | "regle_ponctuelle" | "information",
  "description": "Description claire de la modification en français",
  "changes": [
    {
      "doctorId": "ARMANDO",
      "date": "2026-06-17",
      "morning": "END",
      "afternoon": "END"
    }
  ]
}
</modification>

Si la demande est une question (pas une modification), réponds normalement sans balise <modification>.
Si la demande est ambiguë, pose des questions de clarification.
Si la date n'est pas précise (ex: "lundi prochain"), calcule la date exacte par rapport à aujourd'hui (${new Date().toISOString().slice(0,10)}).
Réponds toujours en français.`;

  const messages = chatHistory
    .filter(m => m.role === 'user' || (m.role === 'assistant' && m.type !== 'confirm'))
    .slice(-10) // 10 derniers messages pour le contexte
    .map(m => ({ role: m.role, content: m.content }));

  // Ajouter le message actuel
  messages.push({ role: 'user', content: userMessage });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });

  const data = await response.json();
  return data.content[0].text;
}

// ── HANDLE RESPONSE ───────────────────────────────────────────────────
function handleClaudeResponse(text) {
  const modMatch = text.match(/<modification>([\s\S]*?)<\/modification>/);

  if (modMatch) {
    try {
      const mod = JSON.parse(modMatch[1].trim());
      pendingModification = mod;

      if (mod.type === 'information') {
        addBotMessage(text.replace(/<modification>[\s\S]*?<\/modification>/g, '').trim());
        return;
      }

      // Afficher la description et demander confirmation
      const confirmText = `${mod.description}\n\nVoulez-vous appliquer cette modification ?`;
      const lastMsg = chatHistory[chatHistory.length - 1];
      chatHistory.push({
        role: 'assistant',
        content: confirmText,
        time: new Date().toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}),
        type: 'confirm',
      });
      renderChatHistory();
    } catch(e) {
      addBotMessage(text.replace(/<modification>[\s\S]*?<\/modification>/g, '').trim());
    }
  } else {
    addBotMessage(text);
  }
}

// ── CONFIRMATION ──────────────────────────────────────────────────────
async function confirmModification() {
  if (!pendingModification) return;

  // Marquer le message confirm comme appliqué
  const confirmMsg = [...chatHistory].reverse().find(m => m.type === 'confirm');
  if (confirmMsg) confirmMsg.type = 'normal';

  addBotMessage('⏳ Application en cours...');

  try {
    // Appeler Apps Script pour appliquer la modification
    const body = {
      action: 'applyModification',
      code: CHAT_ADMIN_CODE,
      modification: pendingModification,
    };
    const params = new URLSearchParams({payload: JSON.stringify(body)});
    const res = await fetch(CHAT_API_URL + '?' + params.toString());
    const data = await res.json();

    // Retirer le message "en cours"
    chatHistory.pop();

    if (data.success) {
      const successMsg = chatHistory[chatHistory.length - 1];
      if (successMsg) successMsg.applied = true;
      addBotMessage('✅ Modification appliquée. Le planning se met à jour automatiquement dans quelques secondes.', 'success');
      // Recharger le planning après 5 secondes
      setTimeout(() => {
        fetch('./planning.json?' + Date.now())
          .then(r => r.json())
          .then(d => { DATA = d; render(); });
      }, 5000);
    } else {
      addBotMessage(`❌ Erreur : ${data.error || 'Modification non appliquée.'}`);
    }
  } catch(e) {
    chatHistory.pop();
    addBotMessage('❌ Erreur de connexion avec le GSheet.');
  }

  pendingModification = null;
  renderChatHistory();
}

function cancelModification() {
  pendingModification = null;
  const confirmMsg = [...chatHistory].reverse().find(m => m.type === 'confirm');
  if (confirmMsg) confirmMsg.type = 'normal';
  addBotMessage('Modification annulée. Que puis-je faire d\'autre ?');
}

// ── RÉSUMÉ MODIFICATIONS ──────────────────────────────────────────────
function updateModifSummary() {
  const applied = chatHistory.filter(m => m.applied).length;
  const summary = document.getElementById('chatModifSummary');
  if (summary) {
    summary.textContent = applied > 0 ? `${applied} modification${applied>1?'s':''} ce jour` : '';
    summary.style.display = applied > 0 ? 'block' : 'none';
  }
}
