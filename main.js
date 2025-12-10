// MCP Server Configuration
// Always use the Netlify proxy to avoid CORS issues
const MCP_SERVER_URL = '/.netlify/functions/mcp-proxy';

// Bank vault address (tz4 address that holds bank funds)
const BANK_VAULT_ADDRESS = 'tz4E74S8UXiPLumxrnPRpLgCMnEgPTgcnv8p';

// Burn address for cash withdrawals (simulating cash dispensing)
const BURN_ADDRESS = 'tz1burnburnburnburnburnburnburjAYjjX';

// User storage key
const USERS_STORAGE_KEY = 'tezos_bank_users';

// DOM Elements
const elements = {
  // Screens
  loginScreen: document.getElementById('login-screen'),
  registerScreen: document.getElementById('register-screen'),
  mainScreen: document.getElementById('main-screen'),

  // Login
  pinDisplay: document.getElementById('pin-display'),
  loginStatus: document.getElementById('login-status'),
  showRegister: document.getElementById('show-register'),

  // Register
  registerAddress: document.getElementById('register-address'),
  registerPin: document.getElementById('register-pin'),
  confirmPin: document.getElementById('confirm-pin'),
  registerBtn: document.getElementById('register-btn'),
  backToLogin: document.getElementById('back-to-login'),
  registerStatus: document.getElementById('register-status'),

  // Main screen
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text'),
  clientBalance: document.getElementById('client-balance'),
  dailyLimit: document.getElementById('daily-limit'),
  txLimit: document.getElementById('tx-limit'),
  spentToday: document.getElementById('spent-today'),
  remaining: document.getElementById('remaining'),
  userAddress: document.getElementById('user-address'),
  logoutBtn: document.getElementById('logout-btn'),

  // Actions
  btnWithdraw: document.getElementById('btn-withdraw'),
  btnDeposit: document.getElementById('btn-deposit'),
  btnHistory: document.getElementById('btn-history'),
  btnRefresh: document.getElementById('btn-refresh'),

  // Modals
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

  // Dispenser and Deposit animations
  dispenserModal: document.getElementById('dispenser-modal'),
  cashStack: document.getElementById('cash-stack'),
  dispenserMessage: document.getElementById('dispenser-message'),
  depositModal: document.getElementById('deposit-modal'),
  cheque: document.getElementById('cheque'),
  chequeAmount: document.getElementById('cheque-amount'),
  depositMessage: document.getElementById('deposit-message'),
};

// State
let currentAction = null;
let currentPin = '';
let currentUser = null;
let addresses = { contract: null, spender: null, owner: null };

// User management
function getUsers() {
  const data = localStorage.getItem(USERS_STORAGE_KEY);
  return data ? JSON.parse(data) : {};
}

function saveUsers(users) {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function hashPin(pin) {
  // Simple hash for demo - in production use proper crypto
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

function registerUser(address, pin) {
  const users = getUsers();
  if (users[address]) {
    return { success: false, error: 'Address already registered' };
  }
  users[address] = { pinHash: hashPin(pin), address };
  saveUsers(users);
  return { success: true };
}

function authenticateUser(pin) {
  const users = getUsers();
  const pinHash = hashPin(pin);

  for (const [address, user] of Object.entries(users)) {
    if (user.pinHash === pinHash) {
      return { success: true, user: { address } };
    }
  }
  return { success: false, error: 'Invalid PIN' };
}

// PIN Display
function updatePinDisplay() {
  const dots = elements.pinDisplay.querySelectorAll('.pin-dot');
  dots.forEach((dot, index) => {
    if (index < currentPin.length) {
      dot.classList.add('filled');
    } else {
      dot.classList.remove('filled');
    }
  });
}

function showLoginError(message) {
  elements.loginStatus.textContent = message;
  elements.loginStatus.className = 'login-status error';
  setTimeout(() => {
    elements.loginStatus.textContent = '';
    elements.loginStatus.className = 'login-status';
  }, 3000);
}

function showLoginSuccess(message) {
  elements.loginStatus.textContent = message;
  elements.loginStatus.className = 'login-status success';
}

function showRegisterError(message) {
  elements.registerStatus.textContent = message;
  elements.registerStatus.className = 'login-status error';
}

function showRegisterSuccess(message) {
  elements.registerStatus.textContent = message;
  elements.registerStatus.className = 'login-status success';
}

// Screen navigation
function showScreen(screen) {
  elements.loginScreen.classList.add('hidden');
  elements.registerScreen.classList.add('hidden');
  elements.mainScreen.classList.add('hidden');

  if (screen === 'login') {
    elements.loginScreen.classList.remove('hidden');
    currentPin = '';
    updatePinDisplay();
  } else if (screen === 'register') {
    elements.registerScreen.classList.remove('hidden');
    elements.registerAddress.value = '';
    elements.registerPin.value = '';
    elements.confirmPin.value = '';
    elements.registerStatus.textContent = '';
    elements.registerStatus.className = 'login-status';
  } else if (screen === 'main') {
    elements.mainScreen.classList.remove('hidden');
  }
}

// Login handler
function handleLogin() {
  if (currentPin.length !== 4) {
    showLoginError('Please enter a 4-digit PIN');
    return;
  }

  const result = authenticateUser(currentPin);
  if (result.success) {
    currentUser = result.user;
    showLoginSuccess('Login successful!');
    setTimeout(() => {
      showScreen('main');
      // Display user's address in welcome message (truncated)
      const addr = currentUser.address;
      elements.userAddress.textContent = `${addr.slice(0, 8)}...${addr.slice(-4)}`;
      refreshAll();
    }, 500);
  } else {
    showLoginError(result.error);
    currentPin = '';
    updatePinDisplay();
  }
}

// Register handler
function handleRegister() {
  const address = elements.registerAddress.value.trim();
  const pin = elements.registerPin.value;
  const confirmPin = elements.confirmPin.value;

  if (!address.startsWith('tz')) {
    showRegisterError('Please enter a valid Tezos address (tz...)');
    return;
  }

  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    showRegisterError('PIN must be exactly 4 digits');
    return;
  }

  if (pin !== confirmPin) {
    showRegisterError('PINs do not match');
    return;
  }

  const result = registerUser(address, pin);
  if (result.success) {
    showRegisterSuccess('Registration successful! Please login.');
    setTimeout(() => {
      showScreen('login');
    }, 1500);
  } else {
    showRegisterError(result.error);
  }
}

// Logout handler
function handleLogout() {
  currentUser = null;
  currentPin = '';
  showScreen('login');
}

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
        'Accept': 'application/json, text/event-stream',
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

// Cash dispenser animation
function showCashDispenser(amount) {
  return new Promise((resolve) => {
    elements.cashStack.innerHTML = '';
    elements.dispenserMessage.textContent = 'Dispensing cash...';
    elements.dispenserModal.classList.add('active');

    // Calculate bills to show (simplified: show up to 5 bills)
    const bills = [];
    let remaining = amount;
    const denominations = [10, 5, 1];

    for (const denom of denominations) {
      while (remaining >= denom && bills.length < 5) {
        bills.push(denom);
        remaining -= denom;
      }
    }

    if (bills.length === 0) {
      bills.push(amount);
    }

    // Animate bills one by one
    bills.forEach((denom, index) => {
      setTimeout(() => {
        const bill = document.createElement('div');
        bill.className = 'cash-bill';
        bill.style.animationDelay = `${index * 0.3}s`;
        bill.innerHTML = `
          <span class="xtz-symbol">XTZ</span>
          <span class="denomination">${denom}</span>
          <span class="xtz-symbol-right">XTZ</span>
        `;
        elements.cashStack.appendChild(bill);
      }, index * 300);
    });

    // Update message and close after animation
    setTimeout(() => {
      elements.dispenserMessage.textContent = `${amount} XTZ dispensed!`;
    }, bills.length * 300 + 500);

    setTimeout(() => {
      elements.dispenserMessage.textContent = 'Please take your cash';
    }, bills.length * 300 + 1500);

    setTimeout(() => {
      elements.dispenserModal.classList.remove('active');
      resolve();
    }, bills.length * 300 + 3000);
  });
}

// Cheque deposit animation
function showChequeDeposit(amount) {
  return new Promise((resolve) => {
    elements.chequeAmount.textContent = `${amount} XTZ`;
    elements.depositMessage.textContent = 'Inserting cheque...';
    elements.cheque.style.animation = 'none';
    elements.cheque.offsetHeight; // Trigger reflow
    elements.cheque.style.animation = 'insert-cheque 2s ease-in-out forwards';
    elements.depositModal.classList.add('active');

    setTimeout(() => {
      elements.depositMessage.textContent = 'Processing cheque...';
    }, 1500);

    setTimeout(() => {
      elements.depositMessage.textContent = 'Cheque accepted!';
    }, 2500);

    setTimeout(() => {
      elements.depositModal.classList.remove('active');
      resolve();
    }, 4000);
  });
}

// Fetch and display balances
async function refreshBalances() {
  try {
    setStatus('loading', 'Fetching balances...');

    const balanceResult = await callMcpTool('tezos_get_balance');
    const balanceText = balanceResult.content?.[0]?.text || '';
    console.log('Balance response:', balanceText);
    const balances = parseBalanceResponse(balanceText);

    if (balances) {
      // Show the contract balance (funds available to withdraw)
      const formattedBalance = formatXtz(balances.contractBalance);
      console.log('Updating balance to:', formattedBalance, '(contract balance)');
      elements.clientBalance.textContent = formattedBalance;
    } else {
      console.log('Could not parse balance response');
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
    console.log('Limits response:', limitsText);

    let limits;
    try {
      limits = JSON.parse(limitsText);
    } catch {
      console.log('Could not parse limits as JSON');
      return;
    }

    console.log('Updating limits:', limits);
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
  console.log('refreshAddresses called');
  try {
    const addressResult = await callMcpTool('tezos_get_addresses');
    console.log('Address raw result:', addressResult);
    const addressText = addressResult.content?.[0]?.text || '';
    console.log('Address response:', addressText);

    let addressData;
    try {
      addressData = JSON.parse(addressText);
      console.log('Parsed address data:', addressData);
    } catch {
      const contractMatch = addressText.match(/Contract[:\s]+([A-Za-z0-9]+)/i);
      const spenderMatch = addressText.match(/Spender[:\s]+([A-Za-z0-9]+)/i);
      addressData = {
        contract: contractMatch?.[1],
        spender: spenderMatch?.[1],
      };
      console.log('Regex parsed address data:', addressData);
    }

    addresses = {
      contract: addressData.contractAddress || addressData.spendingContract || addressData.contract,
      spender: addressData.spenderAddress || addressData.spendingAddress || addressData.spender,
      owner: addressData.ownerAddress || addressData.owner,
    };
    console.log('Final addresses:', addresses);
  } catch (error) {
    console.error('Failed to refresh addresses:', error);
  }
}

// Refresh all data
async function refreshAll() {
  console.log('refreshAll called');
  elements.btnRefresh.disabled = true;
  try {
    await Promise.all([
      refreshBalances(),
      refreshLimits(),
      refreshAddresses(),
    ]);
    console.log('refreshAll completed');
  } catch (error) {
    console.error('refreshAll error:', error);
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
    elements.addressGroup.style.display = 'none'; // Use logged-in user's address
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
      // Send XTZ to burn address (simulating cash dispensing)
      showModalStatus('loading', 'Processing withdrawal...');

      const result = await callMcpTool('tezos_send_xtz', {
        toAddress: BURN_ADDRESS,
        amount,
      });

      // Close the amount modal and show cash dispenser animation
      closeModal();
      await showCashDispenser(amount);

      // Small delay to allow blockchain to update, then refresh
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refreshAll();

    } else if (currentAction === 'deposit') {
      // Show cheque animation first
      closeModal();
      await showChequeDeposit(amount);

      // Then process the actual transfer from user's address to bank vault
      // Note: This is simulated - in reality the user would need to sign this
      // For demo purposes, we transfer from the spending contract to the vault
      try {
        await callMcpTool('tezos_send_xtz', {
          toAddress: BANK_VAULT_ADDRESS,
          amount,
        });
      } catch (err) {
        console.log('Deposit transfer:', err.message);
        // Continue anyway for demo - the cheque animation already showed
      }

      // Small delay to allow blockchain to update, then refresh
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refreshAll();
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

// PIN pad event listeners
function setupPinPad() {
  document.querySelectorAll('.pin-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const digit = btn.dataset.digit;
      const action = btn.dataset.action;

      if (digit !== undefined && currentPin.length < 4) {
        currentPin += digit;
        updatePinDisplay();
      } else if (action === 'clear') {
        currentPin = '';
        updatePinDisplay();
      } else if (action === 'enter') {
        handleLogin();
      }
    });
  });
}

// Event listeners
function setupEventListeners() {
  // Login/Register navigation
  elements.showRegister.addEventListener('click', () => showScreen('register'));
  elements.backToLogin.addEventListener('click', () => showScreen('login'));
  elements.registerBtn.addEventListener('click', handleRegister);
  elements.logoutBtn.addEventListener('click', handleLogout);

  // Main screen actions
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
  setupPinPad();
}

// Initialize
function init() {
  setupEventListeners();
  showScreen('login');
}

// Start
init();
