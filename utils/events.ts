
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

    const savedUsers = localStorage.getItem('microfox_users');
    const usersList = savedUsers ? JSON.parse(savedUsers) : [];
    const defaultCaisses = ['CAISSE PRINCIPALE', 'CAISSE 1', 'CAISSE 2', 'CAISSE 3', 'CAISSE 4'];
    
    const caisseKeysToUpdate = new Set<string>();
    defaultCaisses.forEach(c => {
      caisseKeysToUpdate.add(c);
      caisseKeysToUpdate.add(c.toUpperCase());
    });
    
    usersList.forEach((usr: any) => {
      if (usr.caisse) {
        caisseKeysToUpdate.add(usr.caisse.trim());
        caisseKeysToUpdate.add(usr.caisse.trim().toUpperCase());
      }
    });

    const theoretical: Record<string, number> = {
      'COFFRE': 0,
      'BANQUE': storedBanque,
    };
    
    caisseKeysToUpdate.forEach(c => {
      theoretical[c.toUpperCase()] = 0;
    });

    chronoVaultTxs.forEach((tx: any) => {
      if (tx.type === "Initialisation Coffre Fort") {
        theoretical['COFFRE'] = tx.amount;
      } else if (tx.type === "Initialisation Caisse Principale") {
        theoretical['CAISSE PRINCIPALE'] = tx.amount;
      }
    });

    members.forEach((m: any) => {
      const savedHistoryStr = localStorage.getItem(`microfox_history_${m.id}`);
      const memberHistory = savedHistoryStr ? JSON.parse(savedHistoryStr) : (m.history || []);
      if (memberHistory) {
        memberHistory.forEach((tx: any) => {
          if (tx.isDeleted || tx.type === 'annulation' || tx.status === 'deleted') {
            return;
          }
          const txCaisse = (tx.caisse || '').toUpperCase();
          if (txCaisse && theoretical[txCaisse] !== undefined) {
            const isCredit = [
              'deposit', 'depot', 'cotisation', 'remboursement',
              'parts_sociales_frais', 'frais_adhesion', 'adhesion',
              'part_sociale', 'vente_livret', 'credit'
            ].includes(tx.type);
            const isDebit = [
              'retrait', 'transfert', 'deblocage', 'debit',
              'dépense', 'depense'
            ].includes(tx.type);
            
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

      if (tx.type === "Versement Agent") {
        return;
      }

      // Skip cashier-to-main cashier transfers and regular cashier agent deposits here,
      // as they are handled in the payments loop to prevent double-counting.
      const isCashierTransfer = tx.type === "Versement Caisse Principale" && fromCaisse !== 'COFFRE';
      const isRegularVersement = tx.type === "Versement Caisse";
      if (isCashierTransfer || isRegularVersement) {
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
        if (p.status !== 'Rejeté' && p.status !== 'Annulé' && p.status !== 'Extourné') {
          const sourceCaisse = (p.agentId || '').toUpperCase();
          const targetCaisse = (p.caisse || 'CAISSE PRINCIPALE').toUpperCase();

          if (theoretical[sourceCaisse] !== undefined) {
            const theoreticalAmt = p.totalAmount - (p.gap || 0);
            theoretical[sourceCaisse] -= theoreticalAmt;
          }

          if (p.status === 'Validé' && theoretical[targetCaisse] !== undefined) {
            theoretical[targetCaisse] += (p.observedAmount || p.totalAmount);
          }
        }
      }
    });

    localStorage.setItem('microfox_vault_balance', theoretical['COFFRE'].toString());
    localStorage.setItem('microfox_bank_balance', theoretical['BANQUE'].toString());
    
    caisseKeysToUpdate.forEach(c => {
      const balance = theoretical[c.toUpperCase()] || 0;
      localStorage.setItem(`microfox_cash_balance_${c}`, balance.toString());
    });
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
