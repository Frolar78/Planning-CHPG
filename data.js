'use strict';

// ── MÉDECINS ───────────────────────────────────────────────────────────
const DOCTORS = [
  { id: 'ALBOUY',    name: 'DR ALBOUY',    initials: 'SA'  },
  { id: 'ARMANDO',   name: 'DR ARMANDO',   initials: 'GA'  },
  { id: 'BONNET',    name: 'DR BONNET',    initials: 'LB'  },
  { id: 'BOUREGBA',  name: 'DR BOUREGBA',  initials: 'MB'  },
  { id: 'CATINEAU',  name: 'DR CATINEAU',  initials: 'JC'  },
  { id: 'FROHLICH',  name: 'DR FROHLICH',  initials: 'AFR' },
  { id: 'FERRIERO',  name: 'DR FERRIERO',  initials: 'AF'  },
  { id: 'GHIGLIONE', name: 'DR GHIGLIONE', initials: 'SG'  },
  { id: 'GUERIN',    name: 'DR GUERIN',    initials: 'JPG' },
  { id: 'LEVASSEUR', name: 'DR LEVASSEUR', initials: 'LUL' },
  { id: 'LEY',       name: 'DR LEY',       initials: 'LL'  },
  { id: 'MENADE',    name: 'DR MENADE',    initials: 'RM'  },
  { id: 'OPPRECHT',  name: 'DR OPPRECHT',  initials: 'NO'  },
  { id: 'PARTOUCHE', name: 'DR PARTOUCHE', initials: 'NP'  },
  { id: 'ROUSSEAU',  name: 'DR ROUSSEAU',  initials: 'GR'  },
  { id: 'SALA',      name: 'DR SALA',      initials: 'NS'  },
  { id: 'SEVERAC',   name: 'DR SEVERAC',   initials: 'MS'  },
  { id: 'SULTAN',    name: 'DR SULTAN',    initials: 'WS'  },
  { id: 'SUPLY',     name: 'DR SUPLY',     initials: 'CS'  },
  { id: 'WIDEHEM',   name: 'DR WIDEHEM',   initials: 'RW'  },
  { id: 'ZAMARON',   name: 'DR ZAMARON',   initials: 'FZ'  },
  { id: 'TRAN',      name: 'DR TRAN',      initials: 'DT'  },
  { id: 'PRUNET',    name: 'PR PRUNET',    initials: 'BP'  },
  { id: 'ARMAND',    name: 'DR ARMAND',    initials: 'CA', from: '2026-11-01' },
  { id: 'DRUGE',     name: 'DR DRUGE',     initials: 'AD'  },
];

// ── SECTEURS ───────────────────────────────────────────────────────────
const SECTORS = [
  { code: 'VIS', label: 'Bloc viscéral',              color: '#1D4ED8', bg: '#EFF6FF' },
  { code: 'REA', label: 'Réanimation',                color: '#6D28D9', bg: '#F5F3FF' },
  { code: 'ORT', label: 'Bloc orthopédique',          color: '#166534', bg: '#F0FDF4' },
  { code: 'DVI', label: 'Pose DVI',                   color: '#86198F', bg: '#FDF4FF' },
  { code: 'ORL', label: 'Bloc ORL / Ophtalmologie',   color: '#C2410C', bg: '#FFF7ED' },
  { code: 'END', label: 'Endoscopies',                color: '#0F766E', bg: '#F0FDFA' },
  { code: 'CI',  label: 'Cardiologie interventionnelle', color: '#0369A1', bg: '#F0F9FF' },
  { code: 'RI',  label: 'Radiologie interventionnelle',  color: '#3730A3', bg: '#EEF2FF' },
  { code: 'MAT', label: 'Maternité',                  color: '#BE185D', bg: '#FDF2F8' },
  { code: 'CS',  label: 'Consultation',               color: '#374151', bg: '#F9FAFB' },
];

// ── STATUTS ────────────────────────────────────────────────────────────
const STATUSES = {
  G:  { label: 'Garde 24h',      color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  RG: { label: 'Repos de garde', color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  '18': { label: '8h–18h',       color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  A:  { label: 'Absence',        color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
  CP: { label: 'Congés payés',   color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
  F:  { label: 'Formation',      color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  R:  { label: 'Récup samedi',   color: '#0F766E', bg: '#F0FDFA', border: '#99F6E4' },
};

const ABSENT_STATUSES = new Set(['RG','CP','A','F','R']);
const SECTOR_MAP = Object.fromEntries(SECTORS.map(s => [s.code, s]));
const DOCTOR_MAP = Object.fromEntries(DOCTORS.map(d => [d.id, d]));
