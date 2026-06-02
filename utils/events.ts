
/**
 * Recalculate caisse, vault and bank balances based on transaction ledger
 */
const recalculateMicrofoxBalances = () => {
  try {
    const savedVaultBalance = localStorage.getItem('microfox_vault_balance');
    const savedBankBalance = localStorage.getItem('microfox_bank_balance');
    
    const storedCoffre = savedVaultBalance ? Number(savedVaultBalance) : 0;
    const storedBanque = savedBankBalance ? Number(savedBankBalance) : 0;

    const savedMembers = localStorage.getItem('microfox_members_data');
    const members = savedMembers ? JSON.parse(savedMembers) : [];
    
    const savedVault = localStorage.getItem('microfox_vault_transactions');
    const vaultTxs = savedVault ? JSON.parse(savedVault) : [];
    
    const savedExpenses = localStorage.getItem('microfox_admin_expenses');
    const expenses = savedExpenses ? JSON.parse(savedExpenses) : [];
    
    const savedPayments = localStorage.getItem('microfox_agent_payments');
    const payments = savedPayments ? JSON.parse(savedPayments) : [];

    const chronoVaultTxs = [...vaultTxs].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const theoretical: Record<string, number> = {
      'COFFRE': 0,
      'BANQUE': storedBanque,
      'CAISSE PRINCIPALE': 0,
      'CAISSE 1': 0,
      'CAISSE 2': 0,
      'CAISSE 3': 0,
      'CAISSE 4': 0,
    };

    chronoVaultTxs.forEach((tx: any) => {
      if (tx.type === "Initialisation Coffre Fort") {
        theoretical['COFFRE'] = tx.amount;
      } else if (tx.type === "Initialisation Caisse Principale") {
        theoretical['CAISSE PRINCIPALE'] = tx.amount;
      }
    });

    members.forEach((m: any) => {
      if (m.history) {
        m.history.forEach((tx: any) => {
          const txCaisse = (tx.caisse || '').toUpperCase();
          if (txCaisse && theoretical[txCaisse] !== undefined) {
            const isCredit = tx.type === 'deposit' || tx.type === 'depot' || tx.type === 'cotisation' || tx.type === 'remboursement';
            const isDebit = tx.type === 'retrait' || tx.type === 'transfert' || tx.type === 'deblocage';
            if (isCredit) {
              theoretical[txCaisse] += tx.amount;
            } else if (isDebit) {
              theoretical[txCaisse] -= tx.amount;
            }
          }
        });
      }
    });

    chronoVaultTxs.forEach((tx: any) => {
      const fromCaisse = (tx.from || '').toUpperCase();
      const toCaisse = (tx.to || '').toUpperCase();

      if (tx.type === "Initialisation Coffre Fort" || tx.type === "Initialisation Caisse Principale") {
        return;
      }

      if (fromCaisse === 'COFFRE') {
        theoretical['COFFRE'] -= tx.amount;
      } else if (theoretical[fromCaisse] !== undefined) {
        theoretical[fromCaisse] -= tx.amount;
      }

      if (toCaisse === 'COFFRE') {
        theoretical['COFFRE'] += tx.amount;
      } else if (theoretical[toCaisse] !== undefined) {
        theoretical[toCaisse] += tx.amount;
      }
    });

    expenses.forEach((e: any) => {
      if (!e.isDeleted) {
        const caisse = (e.caisse || 'CAISSE PRINCIPALE').toUpperCase();
        if (theoretical[caisse] !== undefined) {
          theoretical[caisse] -= e.amount;
        }
      }
    });

    payments.forEach((p: any) => {
      if (p.type === 'CASHIER_TRANSFER') {
        const sourceCaisse = (p.agentId || '').toUpperCase();
        if (theoretical[sourceCaisse] !== undefined) {
          if (p.status === 'En attente') {
            const theoreticalAmt = p.totalAmount - (p.gap || 0);
            theoretical[sourceCaisse] -= theoreticalAmt;
          } else if (p.status === 'Validé') {
            theoretical[sourceCaisse] += (p.gap || 0);
          }
        }
      }
    });

    localStorage.setItem('microfox_vault_balance', theoretical['COFFRE'].toString());
    localStorage.setItem('microfox_bank_balance', theoretical['BANQUE'].toString());
    localStorage.setItem('microfox_cash_balance_CAISSE PRINCIPALE', theoretical['CAISSE PRINCIPALE'].toString());
    localStorage.setItem('microfox_cash_balance_CAISSE 1', theoretical['CAISSE 1'].toString());
    localStorage.setItem('microfox_cash_balance_CAISSE 2', theoretical['CAISSE 2'].toString());
    localStorage.setItem('microfox_cash_balance_CAISSE 3', theoretical['CAISSE 3'].toString());
    localStorage.setItem('microfox_cash_balance_CAISSE 4', theoretical['CAISSE 4'].toString());
  } catch (error) {
    console.error('Error in automatic balance recalculation:', error);
  }
};

/**
 * Utilité pour déclencher un événement de synchronisation de stockage de manière compatible.
 * Évite les erreurs "Illegal constructor" sur certains environnements.
 */
export const dispatchStorageEvent = () => {
  try {
    // Recalculate local storage balances first to keep them in perfect conformity
    recalculateMicrofoxBalances();

    // Tentative moderne avec CustomEvent
    let event;
    try {
      event = new CustomEvent('microfox_storage', {
        detail: { timestamp: Date.now() }
      });
    } catch (e) {
      // Fallback sur document.createEvent pour les environnements plus anciens ou restreints
      event = document.createEvent('CustomEvent');
      event.initCustomEvent('microfox_storage', true, true, { timestamp: Date.now() });
    }
    window.dispatchEvent(event);
  } catch (e) {
    console.error('Erreur lors du dispatch de l\'événement de stockage:', e);
  }
};
