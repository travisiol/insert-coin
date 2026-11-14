# Insert Coin — le projet en entier

## En une phrase
Quelqu'un colle un post X ou tape une idée. Le site en fait une memecoin Solana avec son personnage pixel-art. La coin est lancée sur pump.fun **sans que la personne ait besoin d'un wallet**. Ensuite, un « agent » utilise les vrais frais créateur de la coin pour racheter et brûler des tokens, ou pour trader.

C'est le même type de produit qu'ASCII Pad (mêmes fonctionnalités), mais tout est original : code, textes, nom, et style pixel-art « borne d'arcade / console de poche » au lieu de l'ASCII.

## Le parcours utilisateur
1. **/** : la home. L'utilisateur tape son idée dans la borne d'arcade.
2. **/launch**, en 4 étapes :
   - **01 POST OR IDEA** : texte libre, ou lien X. Pour un lien, le texte du post est lu via l'endpoint public oEmbed de X.
   - **02 ENGINE BUILDS** : le moteur propose un nom, un ticker, une histoire en 3 phrases et **3 combattants** au choix. Tout est éditable. REROLL donne un autre tirage.
   - **03 PICK THE AGENT** : BURN, TRADE (1 stratégie parmi 6) ou HYBRID (curseur de répartition). On choisit aussi où vont les gains de trading : burn, réinvestissement ou adresse bénéficiaire.
   - **04 LAUNCH** : vérification des homonymes (combien de tokens Solana ont déjà ce ticker), récapitulatif, puis bouton LAUNCH.
3. Le serveur lance la coin (environ une minute), puis affiche la **clé owner une seule fois** : copier, télécharger en .txt, case « I saved it » obligatoire.
4. La coin a ensuite sa page **/c/TICKER**, son terminal **/t/TICKER**, sa place dans l'**/arcade** et son mini-jeu.

## Les pages
| Page | Contenu |
| --- | --- |
| `/` | Hero, compteurs live (combattants, frais collectés, tokens brûlés), bandeau défilant, comment ça marche, carrousel des 16 archétypes, les 3 agents, les 9 animations, coins tendance et récentes, activité live, niveaux, mini-carte de l'arcade, tableau des stratégies, sécurité, FAQ |
| `/launch` | Le tunnel de création en 4 étapes |
| `/agents` | Toutes les coins, triables (volume, mcap, PnL, buybacks, burns, frais, récentes) et filtrables (actif/pause/dort, mode) |
| `/c/[ticker]` | Combattant animé selon son dernier événement réel, niveau, histoire, adresse du contrat, stats DexScreener, graphique, scorecard de l'agent, registre avec liens Solscan, journal d'événements live, mini-jeu |
| `/t/[ticker]` | Terminal écran vert : help, story, about, chart, buy, world, status, ledger, say, clear, plus 3 commandes perso |
| `/terminals` | Index de tous les terminaux |
| `/arcade` | Monde partagé : 6 zones, déplacement à la souris, zoom 1x-4x, pincement sur mobile, clic sur un combattant pour ouvrir son panneau |
| `/studio` | Éditeur pixel 32x32 : crayon, gomme, remplissage, miroir, annuler/rétablir (50), 4 images par état, pelure d'oignon, aperçu, sauvegarde, puis « LAUNCH THIS FIGHTER » |
| `/owner` | Avec la clé owner : pause/reprise, arrêt d'urgence, mode/split/stratégie, passage aux ordres réels, retrait du solde de trading, édition du terminal |
| `/how` | Explications détaillées, coûts et risques, FAQ |

## Le « Fighter Engine » (la fausse IA)
Ce n'est **pas** un modèle d'IA : c'est du code procédural, sans aucune clé API.
- Le texte est normalisé puis haché (cyrb53), ce qui donne une graine. Le générateur aléatoire (mulberry32) part de cette graine. **Même texte = même résultat partout.**
- Mots-clés : les mots vides sont retirés, les #hashtags et $cashtags gardés, les emojis traduits en mots (🐸 donne frog…).
- 16 archétypes (chat, chien, grenouille, robot, fantôme, alien, ours, hibou, crâne, blob, singe, lapin, astronaute, chevalier, sorcier, fusée), 13 accessoires, 5 types de jambes, 10 yeux, 8 bouches. Le ticker est dessiné sur le torse.
- 9 animations : idle, walk, trading, profit, loss, buyback, burn, bonded, sleep.
- Personnalité du terminal : une voix (hype, grumpy, shy, noble, chaotic, wise), 5 phrases fétiches, un ennemi, 3 commandes perso. `say` détecte l'intention et ne donne jamais de conseil financier : uniquement les données.

## Le lancement (côté serveur, custodial)
1. Création de 2 wallets pour la coin : un **creator** et un **trading**. Leurs clés privées sont chiffrées (AES-256-GCM) en base.
2. Le **wallet funder** envoie 0,03 SOL au wallet creator (loyers + frais ; le reste sert de réserve de frais réseau).
3. PumpPortal construit la transaction de création (dev buy = 0). Le serveur la signe et l'envoie.
4. Le site héberge lui-même les métadonnées (`/api/meta/<mint>`) et l'image (`/api/img/<mint>`), car **l'ancien upload pump.fun/api/ipfs est mort** (vérifié au début).
5. Garde-fous : 3 lancements par IP et par heure, 30 par jour, budget funder de 1 SOL par jour, plus un champ piège et un contrôle de vitesse contre les bots.

## L'agent (le worker, une boucle toutes les 60 s)
Pour chaque coin active :
1. **Arrêt d'urgence global** vérifié en premier.
2. **Réconciliation** : le registre est comparé au solde réel on-chain. Un écart de plus de 10 000 lamports arrête l'agent (HALT).
3. **Collecte des frais créateur** pump.fun, si la simulation montre plus de 0,002 SOL.
4. **Répartition** entre burn et trade selon le mode.
5. **Buyback & burn** : achat par tranches limitées à 2 % d'impact de prix (pump.fun avant le bonding, Jupiter après), puis burn de **exactement** la quantité achetée.
6. **Trading** : candidats pris sur GeckoTerminal et DexScreener, filtre de la stratégie choisie, test anti-honeypot (achat puis revente simulés via Jupiter, perte inférieure à 15 %), TP/SL/trailing/durée max, 3 positions max, limite de perte de 10 % par jour.
   - **Mode dry-run d'abord** : il faut 24 h de signaux simulés avant que le propriétaire puisse activer les ordres réels.
7. 3 transactions ratées d'affilée arrêtent l'agent (HALT).
8. Détection du **bonding**, mise en **sommeil** après 72 h sans événement, **niveaux** 0 à 4.

Règle d'or : **rien n'est affiché sans un événement enregistré en base**, et chaque mouvement d'argent a son lien Solscan.

## Ce qui a été vérifié
- Le build de production et le typecheck passent.
- Le tunnel de lancement fonctionne jusqu'à l'étape 4. La vérification des homonymes utilise des données DexScreener réelles.
- Pages coin, arcade, terminal, agents et home vérifiées avec un coin de test local, supprimé ensuite.
- Endpoints métadonnées, image, OG, owner (mauvaise clé refusée) et lancement (refusé tant que les secrets manquent) : OK.
- Les 6 stratégies ont tourné sur des données de marché réelles, et le contrôle anti-honeypot passe via les devis Jupiter.
- Aucun secret dans le code client.

## Ce qui n'a PAS été testé (à faire avant d'ouvrir au public)
- **Un vrai lancement on-chain.** Il faut les 3 secrets et un wallet funder approvisionné. C'est le « gate » du brief.
- **Que pump.fun affiche bien une coin dont les métadonnées sont sur notre domaine plutôt que sur IPFS.** Probable, mais pas prouvé.
- **La collecte des frais après le bonding** (pool PumpSwap) : si PumpPortal ne la gère pas, il faudra ajouter le SDK pump.fun.
- Le worker en conditions réelles, Lighthouse mobile, et les 60 fps du mini-jeu sur téléphone.

## Risques à connaître
- **Custodial** : le serveur détient les clés de chaque coin. Une fuite de `WALLET_ENCRYPTION_KEY` donne accès à tous les fonds des agents.
- Les agents de trading peuvent tout perdre.
- Faire tourner des fonds pour des tiers peut avoir des implications légales selon le pays : à vérifier avant le lancement public.

## Pour mettre en ligne
Voir `README.md` : base Postgres, `npm run keys`, `npm run db:setup`, Vercel avec les 3 secrets, worker sur Railway ou Fly avec `npm run worker`, puis du SOL sur le wallet funder.
