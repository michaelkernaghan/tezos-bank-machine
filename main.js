// MCP Server Configuration
// Use local proxy on Netlify to avoid CORS, direct URL for local dev
const isLocalDev = window.location.hostname === 'localhost';
const MCP_SERVER_URL = isLocalDev
  ? 'https://tezosx-mcp-production-a8a6.up.railway.app/mcp'
  : '/api/mcp-proxy';

// DOM Elements
const elements = {
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text'),
  bankBalance: document.getElementById('bank-balance'),
  clientBalance: document.getElementById('client-balance'),
  dailyLimit: document.getElementById('daily-limit'),
  txLimit: document.getElementById('tx-limit'),
  spentToday: document.getElementById('spent-today'),
  remaining: document.getElementById('remaining'),
  contractAddress: document.getElementById('contract-address'),
  spenderAddress: document.getElementById('spender-address'),
  btnWithdraw: document.getElementById('btn-withdraw'),
  btnDeposit: document.getElementById('btn-deposit'),
  btnHistory: document.getElementById('btn-history'),
  btnRefresh: document.getElementById('btn-refresh'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modal-title'),
  addressGroup: document.getElementById('address-group'),
  addressInput: document.getElementById('address-input'),
  amountInput: document.getElementById('amount-input'),
  modalCancel: document.getElementById('modal-cancel'),
  modalConfirm: document.getElementById('modal-confirm'),
  modalStatus: document.getElementById('modal-status'),
  historyModal: document.getElementById('history-modal'),
  historyList: document.getElementById('history-list'),
  historyClose: document.getElementById('history-close'),
};

// State
let currentAction = null; // 'withdraw' or 'deposit'
let addresses = { contract: null, spender: null, owner: null };

// MCP Client - Call tools on the MCP server
async function callMcpTool(toolName, args = {}) {
  const requestId = crypto.randomUUID();

  const request = {
    jsonrpc: '2.0',
    id: requestId,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
  };

  try {
    const response = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message || 'MCP error');
    }

    return result.result;
  } catch (error) {
    console.error(`MCP tool ${toolName} failed:`, error);
    throw error;
  }
}

// Format XTZ amount
function formatXtz(mutez) {
  if (typeof mutez === 'string') {
    mutez = parseInt(mutez, 10);
  }
  return (mutez / 1_000_000).toFixed(2);
}

// Parse balance response text
function parseBalanceResponse(text) {
  // "Spending address balance: X mutez. Spending contract balance: Y mutez"
  const match = text.match(/Spending address balance: (\d+) mutez.*Spending contract balance: (\d+) mutez/);
  if (match) {
    return {
      spenderBalance: parseInt(match[1], 10),
      contractBalance: parseInt(match[2], 10),
    };
  }
  return null;
}

// Update status indicator
function setStatus(status, text) {
  elements.statusDot.className = 'status-dot';
  if (status === 'connected') {
    elements.statusDot.classList.add('connected');
  } else if (status === 'error') {
    elements.statusDot.classList.add('error');
  }
  elements.statusText.textContent = text;
}

// Show modal status message
function showModalStatus(type, message) {
  elements.modalStatus.className = `modal-status show ${type}`;
  elements.modalStatus.textContent = message;
}

function hideModalStatus() {
  elements.modalStatus.className = 'modal-status';
}

// Fetch and display balances
async function refreshBalances() {
  try {
    setStatus('loading', 'Fetching balances...');

    const balanceResult = await callMcpTool('tezos_get_balance');
    const balanceText = balanceResult.content?.[0]?.text || '';
    const balances = parseBalanceResponse(balanceText);

    if (balances) {
      elements.bankBalance.textContent = formatXtz(balances.contractBalance);
      elements.clientBalance.textContent = formatXtz(balances.spenderBalance);
    }

    setStatus('connected', 'Connected');
  } catch (error) {
    setStatus('error', 'Connection failed');
    console.error('Failed to refresh balances:', error);
  }
}

// Fetch and display limits
async function refreshLimits() {
  try {
    const limitsResult = await callMcpTool('tezos_get_limits');
    const limitsText = limitsResult.content?.[0]?.text || '';

    // Parse JSON response
    let limits;
    try {
      limits = JSON.parse(limitsText);
    } catch {
      // Try to extract from text format
      console.log('Limits response:', limitsText);
      return;
    }

    elements.dailyLimit.textContent = `${limits.dailyLimit?.xtz || '--'} XTZ`;
    elements.txLimit.textContent = `${limits.perTransactionLimit?.xtz || '--'} XTZ`;
    elements.spentToday.textContent = `${limits.spentToday?.xtz || '--'} XTZ`;
    elements.remaining.textContent = `${limits.remainingDaily?.xtz || '--'} XTZ`;
  } catch (error) {
    console.error('Failed to refresh limits:', error);
  }
}

// Fetch and display addresses
async function refreshAddresses() {
  try {
    const addressResult = await callMcpTool('tezos_get_addresses');
    const addressText = addressResult.content?.[0]?.text || '';

    // Parse JSON or text response
    let addressData;
    try {
      addressData = JSON.parse(addressText);
    } catch {
      // Parse text format: "Contract: KT1..., Owner: tz1..., Spender: tz1..."
      const contractMatch = addressText.match(/Contract[:\s]+([A-Za-z0-9]+)/i);
      const spenderMatch = addressText.match(/Spender[:\s]+([A-Za-z0-9]+)/i);
      addressData = {
        contract: contractMatch?.[1],
        spender: spenderMatch?.[1],
      };
    }

    addresses = {
      contract: addressData.spendingContract || addressData.contract,
      spender: addressData.spendingAddress || addressData.spender,
      owner: addressData.owner,
    };

    elements.contractAddress.textContent = addresses.contract || '--';
    elements.spenderAddress.textContent = addresses.spender || '--';
  } catch (error) {
    console.error('Failed to refresh addresses:', error);
  }
}

// Refresh all data
async function refreshAll() {
  elements.btnRefresh.disabled = true;
  try {
    await Promise.all([
      refreshBalances(),
      refreshLimits(),
      refreshAddresses(),
    ]);
  } finally {
    elements.btnRefresh.disabled = false;
  }
}

// Open modal for transaction
function openModal(action) {
  currentAction = action;
  hideModalStatus();
  elements.amountInput.value = '';
  elements.addressInput.value = '';

  if (action === 'withdraw') {
    elements.modalTitle.textContent = 'Withdraw Funds';
    elements.addressGroup.style.display = 'block';
    elements.addressInput.placeholder = 'tz1... (recipient address)';
  } else if (action === 'deposit') {
    elements.modalTitle.textContent = 'Deposit Funds';
    elements.addressGroup.style.display = 'none';
  }

  elements.modal.classList.add('active');
  elements.amountInput.focus();
}

function closeModal() {
  elements.modal.classList.remove('active');
  currentAction = null;
}

// Execute transaction
async function executeTransaction() {
  const amount = parseFloat(elements.amountInput.value);

  if (isNaN(amount) || amount <= 0) {
    showModalStatus('error', 'Please enter a valid amount');
    return;
  }

  elements.modalConfirm.disabled = true;

  try {
    if (currentAction === 'withdraw') {
      const toAddress = elements.addressInput.value.trim();
      if (!toAddress || !toAddress.startsWith('tz')) {
        showModalStatus('error', 'Please enter a valid recipient address');
        elements.modalConfirm.disabled = false;
        return;
      }

      showModalStatus('loading', 'Processing withdrawal...');

      const result = await callMcpTool('tezos_send_xtz', {
        toAddress,
        amount,
      });

      const resultText = result.content?.[0]?.text || 'Transaction submitted';
      showModalStatus('success', `Success! ${resultText}`);

      // Refresh balances after a short delay
      setTimeout(() => {
        refreshAll();
        closeModal();
      }, 3000);

    } else if (currentAction === 'deposit') {
      // Deposit requires sending directly to contract - this would need Beacon wallet
      // For now, show instructions
      showModalStatus('error',
        `To deposit, send XTZ directly to the contract address: ${addresses.contract}`
      );
    }
  } catch (error) {
    showModalStatus('error', error.message || 'Transaction failed');
  } finally {
    elements.modalConfirm.disabled = false;
  }
}

// Fetch and display transaction history
async function showHistory() {
  elements.historyList.innerHTML = '<div class="loading">Loading history...</div>';
  elements.historyModal.classList.add('active');

  try {
    const result = await callMcpTool('tezos_get_operation_history');
    const historyText = result.content?.[0]?.text || '[]';

    let operations;
    try {
      operations = JSON.parse(historyText);
    } catch {
      elements.historyList.innerHTML = `<div class="history-item">${historyText}</div>`;
      return;
    }

    if (!operations || operations.length === 0) {
      elements.historyList.innerHTML = '<div class="history-item">No transactions found</div>';
      return;
    }

    elements.historyList.innerHTML = operations.slice(0, 20).map(op => {
      const isIncoming = op.target?.address === addresses.contract;
      const amount = formatXtz(op.amount || 0);
      const time = new Date(op.timestamp).toLocaleString();
      const address = isIncoming ? op.sender?.address : op.target?.address;

      return `
        <div class="history-item">
          <div>
            <div class="amount ${isIncoming ? 'incoming' : 'outgoing'}">
              ${isIncoming ? '+' : '-'}${amount} XTZ
            </div>
            <div class="details">${address?.slice(0, 8)}...${address?.slice(-4)}</div>
          </div>
          <div class="time">${time}</div>
        </div>
      `;
    }).join('');
  } catch (error) {
    elements.historyList.innerHTML = `<div class="history-item">Error loading history: ${error.message}</div>`;
  }
}

function closeHistory() {
  elements.historyModal.classList.remove('active');
}

// Quick amount buttons
function setupQuickAmounts() {
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      elements.amountInput.value = btn.dataset.amount;
    });
  });
}

// Event listeners
function setupEventListeners() {
  elements.btnWithdraw.addEventListener('click', () => openModal('withdraw'));
  elements.btnDeposit.addEventListener('click', () => openModal('deposit'));
  elements.btnHistory.addEventListener('click', showHistory);
  elements.btnRefresh.addEventListener('click', refreshAll);

  elements.modalCancel.addEventListener('click', closeModal);
  elements.modalConfirm.addEventListener('click', executeTransaction);
  elements.historyClose.addEventListener('click', closeHistory);

  // Close modal on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeHistory();
    }
  });

  // Close modal on backdrop click
  elements.modal.addEventListener('click', (e) => {
    if (e.target === elements.modal) closeModal();
  });
  elements.historyModal.addEventListener('click', (e) => {
    if (e.target === elements.historyModal) closeHistory();
  });

  setupQuickAmounts();
}

// Initialize
async function init() {
  setStatus('loading', 'Connecting to MCP server...');
  setupEventListeners();
  await refreshAll();
}

// Start
init();
