'use strict';

// ── RÈGLES DE COUVERTURE PAR SECTEUR ──────────────────────────────────
// Pour chaque jour de semaine (0=Lun, 1=Mar, 2=Mer, 3=Jeu, 4=Ven, 5=Sam, 6=Dim)
// morning: secteurs du matin avec effectif requis
// afternoon: secteurs de l'après-midi (souvent CS du secteur du matin)

const COVERAGE_RULES = {
  0: { // Lundi
    morning: [
      { sector: 'VIS', count: 4 },
      { sector: 'END', count: 3 },
      { sector: 'ORT', count: 2 },
      { sector: 'ORL', count: 2 },
      { sector: 'CI',  count: 1 },
      { sector: 'MAT', count: 1 },
      { sector: 'REA', count: 3 },
    ],
    afternoon: [
      { sector: 'CS', count: 4, linkedTo: ['VIS','END'] }, // 2 CS-VIS + 2 CS-END
    ],
  },
  1: { // Mardi
    morning: [
      { sector: 'VIS', count: 3 },
      { sector: 'REA', count: 3 },
      { sector: 'ORT', count: 1 },
      { sector: 'DVI', count: 1 },
      { sector: 'ORL', count: 2 },
      { sector: 'END', count: 3 },
      { sector: 'CI',  count: 1 },
      { sector: 'MAT', count: 1 },
    ],
    afternoon: [
      { sector: 'CS', count: 2, linkedTo: ['ORL','MAT'] }, // matin
      { sector: 'CS', count: 3, linkedTo: ['VIS','END','ORT'] }, // aprem
    ],
  },
  2: { // Mercredi
    morning: [
      { sector: 'VIS', count: 3 },
      { sector: 'REA', count: 3 },
      { sector: 'ORT', count: 2 },
      { sector: 'ORL', count: 2 },
      { sector: 'END', count: 3 },
      { sector: 'RI',  count: 1 },
      { sector: 'CI',  count: 1 },
      { sector: 'MAT', count: 1 },
    ],
    afternoon: [
      { sector: 'CS', count: 2, linkedTo: ['ORL','PED'] },
      { sector: 'CS', count: 4, linkedTo: ['VIS','END','ORT','RI'] },
    ],
  },
  3: { // Jeudi
    morning: [
      { sector: 'VIS', count: 3 },
      { sector: 'REA', count: 3 },
      { sector: 'ORT', count: 1 },
      { sector: 'ORL', count: 2 },
      { sector: 'END', count: 3 },
      { sector: 'RI',  count: 1 },
      { sector: 'MAT', count: 1 },
    ],
    afternoon: [
      { sector: 'CS', count: 2, linkedTo: ['ORL','MAT'] },
      { sector: 'CS', count: 4, linkedTo: ['VIS','END','END','CI'] },
    ],
  },
  4: { // Vendredi
    morning: [
      { sector: 'VIS', count: 3 },
      { sector: 'REA', count: 3 },
      { sector: 'ORT', count: 1 },
      { sector: 'ORL', count: 2 },
      { sector: 'END', count: 3 },
      { sector: 'CI',  count: 1 },
      { sector: 'MAT', count: 1 },
    ],
    afternoon: [
      { sector: 'CS', count: 1, linkedTo: ['ORL'] },
    ],
  },
  5: { // Samedi
    morning: [
      { sector: 'REA', count: 1 },
      { sector: 'MAT', count: 1 },
    ],
    afternoon: [],
  },
  6: { // Dimanche
    morning: [
      { sector: 'REA', count: 1 },
      { sector: 'MAT', count: 1 },
    ],
    afternoon: [],
  },
};

// ── CONTRAINTES GARDES ─────────────────────────────────────────────────
const GUARD_RULES = {
  perDay: 2,           // exactement 2 gardes par jour
  h18PerDay: 1,        // 1 médecin en 18h par jour (semaine uniquement)
  rgNextDay: true,     // RG obligatoire le lendemain d'une garde
  minRestBetween: 1,   // au moins 1 jour entre deux gardes du même médecin
};
