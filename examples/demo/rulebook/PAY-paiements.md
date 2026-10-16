# PAY · Paiements
Comment la boutique encaisse, rembourse et protège le client en cas de litige.

## PAY-P03 · Droit de rétractation
- **Type:** policy · **Nature:** droit de la consommation (rétractation)
**Énoncé.** Un client doit pouvoir renoncer à un achat dans un délai donné après l'avoir reçu.

### PAY-R012 · Remboursement possible jusqu'à 14 jours après la livraison
- **Type:** rule · **Catégorie:** timing · **Applique:** PAY-P03
- **Statut:** changed · **Confiance:** verified · **Audit:** passed
- **Vérifié sur:** b7e8f9a (2026-10-14)

**La règle.** Un remboursement ne peut être demandé que si la commande a été livrée il y a 14 jours ou moins.

**Contexte.** Le délai part de la livraison, pas de la commande. C'est la façon dont le produit applique le droit de rétractation.

**Paramètres.** `14` jours, en dur dans la policy.

**Preuves.**
- enforcement — app/Policies/OrderPolicy.php:9-13 `OrderPolicy::refund`
- test — tests/RefundTest.php:3-5 `test_refund_refused_after_window`

**Cas limites.**
- **PAY-R012.E1** Étant donné une commande jamais livrée, quand le client demande un remboursement, alors la demande est refusée. — read — app/Policies/OrderPolicy.php:11
- **PAY-R012.E2** Étant donné une livraison il y a exactement 14 jours, quand le client demande un remboursement, alors la demande est acceptée. — verified

**Questions ouvertes.** Les jours fériés comptent-ils dans les 14 jours ? Aujourd'hui, oui.

**Historique.**
- 2026-10-14 · b7e8f9a · changed · délai passé de 30 à 14 jours
- 2026-10-02 · a1b2c3d · created

### PAY-R019 · Un remboursement de plus de 500 € demande un administrateur
- **Type:** rule · **Catégorie:** authorization · **Applique:** PAY-P03
- **Statut:** active · **Confiance:** read · **Audit:** passed
- **Vérifié sur:** c3d4e5f (2026-10-15)

**La règle.** Un remboursement de plus de 500 € doit être approuvé par un administrateur avant d'être versé.

**Contexte.** Protège la boutique contre les remboursements importants faits par erreur depuis le support.

**Preuves.**
- enforcement — app/Services/RefundService.php:6-8 `RefundService::approve`

**Historique.**
- 2026-10-15 · c3d4e5f · created

## Other operating rules

### PAY-R020 · Le remboursement revient sur le moyen de paiement d'origine
- **Type:** rule · **Catégorie:** integration
- **Statut:** active · **Confiance:** inferred

**La règle.** Un remboursement est toujours renvoyé sur la carte utilisée pour la commande.

**Contexte.** Déduit du nom de la méthode de paiement ; aucun chemin d'exécution lu de bout en bout.
