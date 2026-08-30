// ingestion/env.js
//
// Chargeur de fichier .env minimal — le projet n'a aucune dépendance externe,
// donc pas de `dotenv`. Lit .env à la racine et alimente process.env sans
// jamais écraser une variable déjà définie (une variable d'environnement réelle,
// par exemple dans une GitHub Action, l'emporte sur le fichier local).

'use strict';

const fs = require('fs');
const path = require('path');

function chargerEnv(fichier = path.join(__dirname, '..', '.env')) {
  let contenu;
  try {
    contenu = fs.readFileSync(fichier, 'utf8');
  } catch {
    return; // pas de .env : on tourne avec les variables d'environnement seules
  }

  for (const ligne of contenu.split('\n')) {
    const l = ligne.trim();
    if (!l || l.startsWith('#')) continue;
    const i = l.indexOf('=');
    if (i === -1) continue;
    const cle = l.slice(0, i).trim();
    let valeur = l.slice(i + 1).trim();
    // Tolère les valeurs entre guillemets, au cas où.
    if ((valeur.startsWith('"') && valeur.endsWith('"')) || (valeur.startsWith("'") && valeur.endsWith("'"))) {
      valeur = valeur.slice(1, -1);
    }
    if (cle && !process.env[cle]) process.env[cle] = valeur;
  }
}

module.exports = { chargerEnv };
