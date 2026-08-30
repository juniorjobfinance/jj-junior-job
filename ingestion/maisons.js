// ingestion/maisons.js
//
// Charge la liste des grandes maisons (ingestion/maisons.txt) et fournit la
// reconnaissance d'un employeur.
//
// Pourquoi un fichier texte plutôt qu'un tableau dans le code : cette liste est
// la définition même du périmètre du site. Elle doit pouvoir être relue et
// corrigée par quelqu'un qui n'ouvre pas pipeline.js — et une maison ajoutée ne
// doit jamais demander de toucher au code.

'use strict';

const fs = require('fs');
const path = require('path');

const LISTE_PATH = path.join(__dirname, 'maisons.txt');

// "Société Générale" et "SOCIETE GENERALE" doivent être le même nom pour la
// comparaison : on retire accents, ponctuation et casse avant de confronter au
// motif. Les motifs du fichier sont donc écrits sans accent.
function aplatir(nom) {
  return (nom || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    // "Groupe Crédit Coopératif", "Groupe BPCE" : le préfixe est du décor
    // administratif, et il empêchait les motifs ancrés au début de mordre.
    .replace(/^(groupe|group)\s+/, '');
}

function chargerMaisons() {
  const lignes = fs.readFileSync(LISTE_PATH, 'utf8').split('\n');
  const maisons = [];
  lignes.forEach((ligne, i) => {
    const nu = ligne.trim();
    if (!nu || nu.startsWith('#')) return;
    const sep = nu.indexOf('|');
    if (sep === -1) {
      console.warn(`[maisons] ligne ${i + 1} ignorée (pas de "|") : ${nu}`);
      return;
    }
    const nom = nu.slice(0, sep).trim();
    const motif = nu.slice(sep + 1).trim();
    if (!nom || !motif) return;
    // Un caractère de contrôle dans un motif le rend impossible à satisfaire, et
    // en silence : c'est arrivé quand un "\b" a été écrit comme le caractère
    // backspace. Mieux vaut le signaler bruyamment que perdre une maison.
    if (/[\x00-\x1f]/.test(motif)) {
      console.warn(`[maisons] ligne ${i + 1} (${nom}) : caractère de contrôle dans le motif, maison ignorée.`);
      return;
    }
    try {
      // Ancré au début du nom, sauf si le motif commence déjà par ".*" : sans
      // cet ancrage, "sia" attraperait "Assia", et "total" attraperait
      // "Sous-total Conseil".
      const source = motif.startsWith('.*') ? motif : '^(?:' + motif + ')';
      maisons.push({ nom, re: new RegExp(source, 'i') });
    } catch (err) {
      console.warn(`[maisons] motif invalide ligne ${i + 1} (${nom}) : ${err.message}`);
    }
  });
  return maisons;
}

const MAISONS = chargerMaisons();

// Renvoie le nom de la grande maison correspondant à cet employeur, ou null.
// Le premier motif qui correspond gagne : l'ordre du fichier fait foi, ce qui
// permet de placer "Crédit Agricole CIB" avant "Crédit Agricole".
function trouverMaison(emp) {
  const plat = aplatir(emp);
  if (!plat) return null;
  for (const m of MAISONS) {
    if (m.re.test(plat)) return m.nom;
  }
  return null;
}

module.exports = { MAISONS, trouverMaison, aplatir };
