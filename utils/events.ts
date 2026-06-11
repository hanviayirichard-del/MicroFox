
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

    const savedGaps = localStorage.getItem('microfox_all_gaps');
    const allGaps = savedGaps ? JSON.parse(savedGaps) : [];

    const savedWithdrawals = localStorage.getItem('microfox_validated_withdrawals');
    const allValidatedWithdrawals = savedWithdrawals ? JSON.parse(savedWithdrawals) : [];

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

    const agentIds = usersList.filter((u: any) => u.role === 'agent commercial').map((u: any) => u.id);
    const seenTxIds = new Set<string>();

    members.forEach((member: any) => {
      let memberHistory = member.history;
      if (!Array.isArray(memberHistory)) {
        const savedHistoryStr = localStorage.getItem(`microfox_history_${member.id}`);
        memberHistory = savedHistoryStr ? JSON.parse(savedHistoryStr) : [];
      }
      
      if (memberHistory) {
        memberHistory.forEach((tx: any) => {
          if (tx.isDeleted || tx.type === 'annulation' || tx.status === 'deleted') {
            return;
          }
          
          const txKey = tx.id || `${tx.date}_${tx.type}_${tx.amount}_${member.id}_${tx.description}`;
          if (seenTxIds.has(txKey)) return;

          if (tx.type === 'deblocage') {
            const deblocageKey = `debloc_strict_${tx.date.split('T')[0]}_${Math.round(tx.amount)}_${member.id}`;
            if (seenTxIds.has(deblocageKey)) return;
            seenTxIds.add(deblocageKey);
          }
          seenTxIds.add(txKey);

          const txUser = usersList.find((u: any) => u.id === tx.userId);
          const txCaisse = (tx.caisse || txUser?.caisse || 'N/A').toUpperCase().trim();
          
          if (theoretical[txCaisse] !== undefined) {
            const desc = (tx.description || '').toLowerCase();
            
            let isCaisseInflow = false;
            let isCaisseOutflow = false;

            if (tx.account === 'epargne' || tx.account === 'frais' || tx.account === 'partSociale') {
              if (tx.type === 'depot') {
                isCaisseInflow = true;
              }
              if (tx.type === 'retrait' || tx.type === 'transfert') {
                isCaisseOutflow = true;
              }
            } else if (tx.account === 'tontine') {
              if (tx.type === 'depot' || tx.type === 'cotisation') {
                if (!agentIds.includes(tx.userId)) {
                  isCaisseInflow = true;
                }
              }
              if (tx.type === 'retrait' || tx.type === 'transfert') {
                isCaisseOutflow = true;
              }
            } else if (tx.account === 'credit') {
              if (tx.type === 'deblocage' && !desc.includes('pénalité') && !desc.includes('penalite')) {
                isCaisseOutflow = true;
              }
              if (tx.type === 'remboursement') {
                isCaisseInflow = true;
              }
            } else if (tx.account === 'garantie') {
              if (tx.type === 'depot') {
                isCaisseInflow = true;
              }
              if (tx.type === 'retrait' || tx.type === 'transfert') {
                isCaisseOutflow = true;
              }
            }

            if (tx.type === 'transfert' && tx.destinationAccount) {
              if (tx.destinationAccount === 'tontine') {
                if (!agentIds.includes(tx.userId)) {
                  isCaisseInflow = true;
                }
              } else {
                isCaisseInflow = true;
              }
            }

            if (isCaisseInflow) {
              theoretical[txCaisse] += tx.amount || 0;
            }
            if (isCaisseOutflow) {
              theoretical[txCaisse] -= tx.amount || 0;
            }
          }
        });
      }
    });

    chronoVaultTxs.forEach((v: any) => {
      const fromCaisse = (v.from || '').toUpperCase().trim();
      const toCaisse = (v.to || '').toUpperCase().trim();

      if (v.type === "Initialisation Coffre Fort" || v.type === "Initialisation Caisse Principale") {
        return;
      }

      if (v.type === "Versement Agent") {
        return;
      }

      const isCashierTransfer = v.type === "Versement Caisse Principale" && fromCaisse !== 'COFFRE';
      const isRegularVersement = v.type === "Versement Caisse";
      if (isCashierTransfer || isRegularVersement) {
        return;
      }

      if (v.type === 'Approvisionnement Caisse' || v.type === 'Fonds de caisse' || v.type === 'Versement Caisse' || v.type === 'Régularisation Écart') {
        if (theoretical[toCaisse] !== undefined) {
          theoretical[toCaisse] += v.amount || 0;
        }
      } else if (v.type === 'Versement au Coffre' || v.type === 'Versement Fin de Journée' || v.type === 'Versement Caisse') {
        if (theoretical[fromCaisse] !== undefined) {
          theoretical[fromCaisse] -= v.amount || 0;
        }
      }
    });

    expenses.forEach((e: any) => {
      if (!e.isDeleted) {
        const expUser = usersList.find((u: any) => u.identifiant === e.recordedBy);
        const caisse = (e.caisse || expUser?.caisse || 'CAISSE PRINCIPALE').toUpperCase().trim();
        if (theoretical[caisse] !== undefined) {
          theoretical[caisse] -= e.amount || 0;
        }
      }
    });

    payments.forEach((p: any) => {
      const amount = p.observedAmount !== undefined ? p.observedAmount : (p.totalAmount || 0);
      
      if (p.type === 'CASHIER_TRANSFER') {
        const sourceCaisse = (p.agentId || '').toUpperCase().trim();
        const targetCaisse = (p.caisse || 'CAISSE PRINCIPALE').toUpperCase().trim();

        if (p.status === 'Validé' || p.status === 'En attente') {
          if (theoretical[sourceCaisse] !== undefined) {
            theoretical[sourceCaisse] -= amount;
          }
        }

        if (p.status === 'Validé') {
          if (theoretical[targetCaisse] !== undefined) {
            theoretical[targetCaisse] += amount;
          }
        }
      } else {
        const targetCaisse = (p.caisse || '').toUpperCase().trim();
        if (p.status === 'Validé') {
          if (theoretical[targetCaisse] !== undefined) {
            theoretical[targetCaisse] += amount;
          }
        }
      }
    });

    allValidatedWithdrawals.forEach((v: any) => {
      const vUser = usersList.find((u: any) => u.id === v.userId);
      const vCaisse = (vUser?.caisse || 'N/A').toUpperCase().trim();
      const gap = v.gap || 0;
      if (theoretical[vCaisse] !== undefined) {
        theoretical[vCaisse] -= gap;
      }
    });

    allGaps.forEach((g: any) => {
      const gUser = usersList.find((u: any) => u.id === g.userId);
      const gCaisse = (g.caisse || gUser?.caisse || 'N/A').toUpperCase().trim();
      const gapAmount = g.gapAmount || 0;
      
      // Skip CAISSIER gaps to prevent double subtraction as they are already accounted for by vault transactions
      if (g.type === 'CAISSIER') return;

      if (theoretical[gCaisse] !== undefined) {
        theoretical[gCaisse] -= gapAmount;
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
