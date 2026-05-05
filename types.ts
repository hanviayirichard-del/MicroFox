
import { ReactNode } from 'react';

export interface MenuItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number | string;
  variant?: 'default' | 'success';
}

export interface SidebarProps {
  onSelect: (id: string) => void;
  activeId: string;
  onClose: () => void;
  onLogout: () => void;
  onSync: () => Promise<void>;
  isSyncing?: boolean;
}

export type UserRole = 'administrateur' | 'directeur' | 'gestionnaire de crédit' | 'caissier' | 'contrôleur' | 'auditeur' | 'agent commercial';

export interface User {
  id: string;
  identifiant: string;
  role: UserRole;
  microfinance: string;
  codeMF: string;
  motDePasse: string;
  zoneCollecte?: string;
  zonesCollecte?: string[];
  caisse?: string;
  isBlocked?: boolean;
  isDeleted?: boolean;
  isHiddenForDistribution?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  lastUpdate?: string;
  fingerprintCredential?: {
    id: string;
    publicKey: string;
  };
}

export interface TontineAccount {
  id: string;
  number: string;
  dailyMise: number;
  balance: number;
  zone?: string;
  isBlocked?: boolean;
  isInvisible?: boolean;
}

export interface Transaction {
  id: string;
  type: 'depot' | 'retrait' | 'cotisation' | 'remboursement' | 'transfert' | 'deblocage';
  account: 'epargne' | 'tontine' | 'credit' | 'garantie' | 'partSociale' | 'frais';
  tontineAccountId?: string;
  tontineAccountIds?: string[];
  tontineAccountNumber?: string;
  amount: number;
  date: string;
  description: string;
  userId?: string;
  destinationAccount?: 'epargne' | 'tontine' | 'credit' | 'garantie' | 'partSociale';
  balance?: number;
  balanceBefore?: number;
  cashierName?: string;
  caisse?: string;
  rembCapital?: number;
  rembInterest?: number;
  rembPenalty?: number;
  rembRebate?: number;
  isValidated?: boolean;
  validatedAt?: string;
}

export interface ClientAccount {
  id: string;
  name: string;
  code: string;
  epargneAccountNumber?: string;
  status: 'Actif' | 'Passif';
  balances: {
    epargne: number;
    tontine: number;
    credit: number;
    garantie: number;
    partSociale: number;
  };
  tontineAccounts: TontineAccount[];
  history: Transaction[];
  gender?: string;
  birthDate?: string;
  phoneNumber?: string;
  address?: string;
  birthPlace?: string;
  profession?: string;
  idType?: string;
  idNumber?: string;
  nationality?: string;
  photo?: string | null;
  signature?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  zone?: string;
  // Champs de crédit
  dossierInstruitPar?: string;
  dureeCredit?: string;
  nomCaution?: string;
  adresseCaution?: string;
  telCaution?: string;
  refCaution?: string;
  telRefCaution?: string;
  creditStatus?: 'Sain' | 'Retard' | 'Contentieux';
  isEpargneBlocked?: boolean;
  isEpargneInvisible?: boolean;
  lastCreditDetails?: {
    capital: number;
    interest: number;
    fees: number;
    penalty: number;
    rebate?: number;
    dueDate: string;
    duration: string;
  };
  lastCreditRequest?: {
    capital: number;
    interest: number;
    fees: number;
    penalty: number;
    rebate?: number;
    dueDate: string;
    duration: string;
  };
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: 'CONNEXION' | 'DECONNEXION' | 'CONSULTATION' | 'MODIFICATION' | 'SUPPRESSION' | 'CREATION';
  module: string;
  details: string;
  ip?: string;
  status: 'SUCCES' | 'ECHEC';
}

export interface FieldControlReport {
  id: string;
  date: string;
  clientId: string;
  clientName: string;
  clientCode: string;
  tontineAccountId: string;
  tontineAccountNumber: string;
  systemBalance: number;
  bookletBalance: number;
  difference: number;
  observations: string;
  recommendations: string;
  controllerId: string;
  controllerName: string;
  adminComments?: string;
  zone?: string;
}

export interface Gap {
  id: string;
  date: string;
  opDate?: string;
  type: 'TONTINE' | 'AGENT' | 'CAISSIER';
  sourceId: string; // ID of the original transaction/payment
  sourceName: string; // Name of the person responsible (Client, Agent, or Cashier)
  sourceCode?: string; // Code (Client Code or Agent ID)
  declaredAmount: number;
  observedAmount: number;
  disbursedAmount?: number;
  gapAmount: number;
  status: 'En attente' | 'Régularisé' | 'Litige' | 'Annulé' | 'Payé' | 'Remis';
  zone?: string;
  regDate?: string;
  regMode?: string;
  observation?: string;
  validatorId?: string;
  userId?: string;
  caisse?: string;
}

export interface AutoDeactivationRule {
  id: string;
  roles: UserRole[];
  days: string[];
  startTime: string;
  endTime: string;
  enabled: boolean;
}

export interface Microfinance {
  nom: string;
  adresse: string;
  code: string;
  telephone?: string;
  prixPartSociale?: number;
  prixAdhesion?: number;
  prixLivretCompte?: number;
  prixLivretTontine?: number;
  fraisTenuCompte?: number;
  frequenceFraisTenueCompte?: 'mensuel' | 'trimestriel' | 'semestriel' | 'annuel';
  tauxRemunerationEpargne?: number;
  autoDeactivationEnabled?: boolean;
  autoDeactivationDays?: string[];
  autoDeactivationStartTime?: string;
  autoDeactivationEndTime?: string;
  autoDeactivationRules?: AutoDeactivationRule[];
  gpsTrackingEnabled?: boolean;
}
