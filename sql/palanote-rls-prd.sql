-- ============================================================
-- Palanote — Les politiques RLS issues du PRD
-- Chaque règle d'accès du PRD (fiches F1 à F6 + exigences « Sécurité » et « Vie privée »)
-- traduite en politique Supabase. Ce sont les politiques en place dans la base (vérifiées le 20/10/2026).
-- Script rejouable : drop policy if exists, puis create policy.
-- Prérequis : est_admin() (palanote-tableau-de-bord.sql), peut_voir_chemin() (palanote-binomes.sql).
-- ============================================================


-- ------------------------------------------------------------
-- F1 · « Une plongée appartient à un seul plongeur ; RLS sur plongeur_id »
-- F4 · « Calcul à la volée sur les plongées du plongeur connecté »
-- F6 · « Export complet à tout moment »
-- Table : dives
-- ------------------------------------------------------------
alter table public.dives enable row level security;

-- SELECT · Un plongeur ne lit que ses propres plongées (carnet, statistiques, carte, export)
drop policy if exists "dives_select_own" on public.dives;
create policy "dives_select_own" on public.dives
  for select to authenticated
  using (auth.uid() = user_id);

-- INSERT · Un plongeur ne crée une plongée que dans son propre carnet
--          (y compris une plongée proposée par un binôme ou lue par l'IA : c'est lui qui l'ajoute en validant)
drop policy if exists "dives_insert_own" on public.dives;
create policy "dives_insert_own" on public.dives
  for insert to authenticated
  with check (auth.uid() = user_id);

-- UPDATE · Un plongeur ne modifie que ses plongées, et ne peut pas les donner à quelqu'un d'autre
drop policy if exists "dives_update_own" on public.dives;
create policy "dives_update_own" on public.dives
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE · Un plongeur ne supprime que ses plongées
drop policy if exists "dives_delete_own" on public.dives;
create policy "dives_delete_own" on public.dives
  for delete to authenticated
  using (auth.uid() = user_id);


-- ------------------------------------------------------------
-- F2 · « Aucune fiche n'est enregistrée sans validation humaine ; chaque champ extrait est éditable ;
--        l'image peut être conservée en pièce jointe »
-- Tables : ocr_batches (le carnet numérisé), ocr_pages (les photos de pages), ocr_extractions (les plongées proposées)
-- L'agent écrit seulement des propositions dans ocr_extractions (côté serveur). Une plongée n'entre dans
-- « dives » que quand le plongeur valide : l'insertion passe par dives_insert_own ci-dessus.
-- ------------------------------------------------------------
alter table public.ocr_batches enable row level security;
alter table public.ocr_pages enable row level security;
alter table public.ocr_extractions enable row level security;

-- SELECT · Un plongeur ne voit que ses carnets numérisés
drop policy if exists "Lire ses lots" on public.ocr_batches;
create policy "Lire ses lots" on public.ocr_batches
  for select to authenticated using (auth.uid() = user_id);
-- INSERT · Il ne crée un carnet numérisé que pour lui
drop policy if exists "Creer un lot" on public.ocr_batches;
create policy "Creer un lot" on public.ocr_batches
  for insert to authenticated with check (auth.uid() = user_id);
-- UPDATE · Il ne modifie que les siens
drop policy if exists "Modifier son lot" on public.ocr_batches;
create policy "Modifier son lot" on public.ocr_batches
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- DELETE · Il ne supprime que les siens
drop policy if exists "Supprimer son lot" on public.ocr_batches;
create policy "Supprimer son lot" on public.ocr_batches
  for delete to authenticated using (auth.uid() = user_id);

-- Les pages : accessibles seulement si le carnet numérisé appartient au plongeur connecté
drop policy if exists "Lire ses pages" on public.ocr_pages;
create policy "Lire ses pages" on public.ocr_pages
  for select to authenticated
  using (exists (select 1 from public.ocr_batches b where b.id = ocr_pages.batch_id and b.user_id = auth.uid()));
drop policy if exists "Ajouter une page" on public.ocr_pages;
create policy "Ajouter une page" on public.ocr_pages
  for insert to authenticated
  with check (exists (select 1 from public.ocr_batches b where b.id = ocr_pages.batch_id and b.user_id = auth.uid()));
drop policy if exists "Modifier sa page" on public.ocr_pages;
create policy "Modifier sa page" on public.ocr_pages
  for update to authenticated
  using (exists (select 1 from public.ocr_batches b where b.id = ocr_pages.batch_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.ocr_batches b where b.id = ocr_pages.batch_id and b.user_id = auth.uid()));
drop policy if exists "Supprimer sa page" on public.ocr_pages;
create policy "Supprimer sa page" on public.ocr_pages
  for delete to authenticated
  using (exists (select 1 from public.ocr_batches b where b.id = ocr_pages.batch_id and b.user_id = auth.uid()));

-- Les plongées proposées par l'agent : lisibles et corrigeables (champ par champ) par le seul propriétaire du carnet
drop policy if exists "Lire ses extractions" on public.ocr_extractions;
create policy "Lire ses extractions" on public.ocr_extractions
  for select to authenticated
  using (exists (select 1 from public.ocr_pages p join public.ocr_batches b on b.id = p.batch_id
                 where p.id = ocr_extractions.page_id and b.user_id = auth.uid()));
drop policy if exists "Creer une extraction" on public.ocr_extractions;
create policy "Creer une extraction" on public.ocr_extractions
  for insert to authenticated
  with check (exists (select 1 from public.ocr_pages p join public.ocr_batches b on b.id = p.batch_id
                      where p.id = ocr_extractions.page_id and b.user_id = auth.uid()));
drop policy if exists "Modifier son extraction" on public.ocr_extractions;
create policy "Modifier son extraction" on public.ocr_extractions
  for update to authenticated
  using (exists (select 1 from public.ocr_pages p join public.ocr_batches b on b.id = p.batch_id
                 where p.id = ocr_extractions.page_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.ocr_pages p join public.ocr_batches b on b.id = p.batch_id
                      where p.id = ocr_extractions.page_id and b.user_id = auth.uid()));
drop policy if exists "Supprimer son extraction" on public.ocr_extractions;
create policy "Supprimer son extraction" on public.ocr_extractions
  for delete to authenticated
  using (exists (select 1 from public.ocr_pages p join public.ocr_batches b on b.id = p.batch_id
                 where p.id = ocr_extractions.page_id and b.user_id = auth.uid()));


-- ------------------------------------------------------------
-- Sécurité · « Photos privées : stockées dans un espace privé (bucket photos) »
-- F3 · « Un binôme ne voit que les plongées partagées » (et donc leurs photos)
-- Table : storage.objects (bucket privé « photos », un dossier par plongeur : <user_id>/...)
-- ------------------------------------------------------------
drop policy if exists "photos_lire_les_siennes" on storage.objects;
create policy "photos_lire_les_siennes" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos_lire_celles_de_ma_palanquee" on storage.objects;
create policy "photos_lire_celles_de_ma_palanquee" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and public.peut_voir_chemin(name));
drop policy if exists "photos_ajouter_les_siennes" on storage.objects;
create policy "photos_ajouter_les_siennes" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos_modifier_les_siennes" on storage.objects;
create policy "photos_modifier_les_siennes" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos_supprimer_les_siennes" on storage.objects;
create policy "photos_supprimer_les_siennes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);


-- ------------------------------------------------------------
-- F3 · « La plongée proposée n'entre dans le carnet qu'après validation du destinataire ;
--        un binôme ne voit que les plongées partagées, jamais le reste du carnet »
-- Tables : dive_buddies (qui a identifié qui sur quelle plongée), friendships, friend_invites
-- Aucune politique sur « dives » ne donne accès au carnet d'un autre : la copie d'une plongée partagée
-- passe par une fonction serveur qui ne recopie que les champs communs, puis l'insertion par dives_insert_own.
-- ------------------------------------------------------------
alter table public.dive_buddies enable row level security;
alter table public.friendships enable row level security;
alter table public.friend_invites enable row level security;

-- SELECT · On voit une identification seulement si on l'a faite ou si c'est nous qui sommes identifié
drop policy if exists "Lire ses identifications" on public.dive_buddies;
create policy "Lire ses identifications" on public.dive_buddies
  for select to authenticated
  using (auth.uid() = identifie_par or auth.uid() = buddy_user_id);

-- SELECT · On ne voit que les relations d'amitié dont on fait partie
drop policy if exists "Lire ses relations" on public.friendships;
create policy "Lire ses relations" on public.friendships
  for select to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);
-- DELETE · Chacun des deux peut mettre fin au binôme
drop policy if exists "Retirer un ami" on public.friendships;
create policy "Retirer un ami" on public.friendships
  for delete to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

-- SELECT · On ne voit que les invitations (QR code) qu'on a émises ou utilisées
drop policy if exists "Lire ses invitations" on public.friend_invites;
create policy "Lire ses invitations" on public.friend_invites
  for select to authenticated
  using (auth.uid() = emis_par or auth.uid() = utilise_par);


-- ------------------------------------------------------------
-- Vie privée / RGPD · « Mon profil », « Confidentialité : accepte ou non la lettre annuelle »
-- Tables : profiles, user_settings, consents
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.consents enable row level security;

-- SELECT · Chacun ne lit que son profil
drop policy if exists "Palanote lire son profil" on public.profiles;
create policy "Palanote lire son profil" on public.profiles
  for select to authenticated using (auth.uid() = id);
-- INSERT · Chacun ne crée que son propre profil
drop policy if exists "Palanote creer son profil" on public.profiles;
create policy "Palanote creer son profil" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
-- UPDATE · Chacun ne modifie que son profil
drop policy if exists "Palanote modifier son profil" on public.profiles;
create policy "Palanote modifier son profil" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- SELECT / UPDATE · Chacun ne lit et ne modifie que ses préférences (unités, notifications)
drop policy if exists "Lire ses préférences" on public.user_settings;
create policy "Lire ses préférences" on public.user_settings
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Modifier ses préférences" on public.user_settings;
create policy "Modifier ses préférences" on public.user_settings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- SELECT · Chacun ne lit que ses consentements
drop policy if exists "Lire ses consentements" on public.consents;
create policy "Lire ses consentements" on public.consents
  for select to authenticated using (auth.uid() = user_id);
-- INSERT · On ne donne un consentement que pour soi, et il naît actif
drop policy if exists "Donner un consentement" on public.consents;
create policy "Donner un consentement" on public.consents
  for insert to authenticated with check (auth.uid() = user_id and revoque_le is null);
-- UPDATE · On peut seulement révoquer son consentement actif (jamais le réactiver ni l'antidater)
drop policy if exists "Révoquer un consentement" on public.consents;
create policy "Révoquer un consentement" on public.consents
  for update to authenticated
  using (auth.uid() = user_id and revoque_le is null)
  with check (auth.uid() = user_id and revoque_le is not null);


-- ------------------------------------------------------------
-- Coûts · « Plafond de pages numérisées par compte, vérifié par le serveur »
-- Tables : quota_ia, forfaits — lecture seule pour le plongeur ; seul le serveur décompte et attribue
-- ------------------------------------------------------------
alter table public.quota_ia enable row level security;
alter table public.forfaits enable row level security;

drop policy if exists "quota_lire_le_sien" on public.quota_ia;
create policy "quota_lire_le_sien" on public.quota_ia
  for select to authenticated using (auth.uid() = user_id or public.est_admin());
drop policy if exists "forfaits_lire_les_siens" on public.forfaits;
create policy "forfaits_lire_les_siens" on public.forfaits
  for select to authenticated using (auth.uid() = user_id or public.est_admin());
-- (aucune politique INSERT / UPDATE / DELETE : impossible de se créditer des pages depuis l'app)


-- ------------------------------------------------------------
-- Sécurité · « Tableau de bord réservé : seul le compte inscrit dans la table des administrateurs y a accès »
-- Nouveau V2 · « Dis-moi ce qui manque : envoie un retour privé à l'auteur de l'app »
-- Tables : feedback, app_errors, lettres
-- ------------------------------------------------------------
alter table public.feedback enable row level security;
alter table public.app_errors enable row level security;
alter table public.lettres enable row level security;

-- INSERT · Tout le monde peut envoyer un retour, anonyme ou en son nom (jamais au nom d'un autre)
drop policy if exists "Envoyer un retour" on public.feedback;
create policy "Envoyer un retour" on public.feedback
  for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());
-- SELECT / UPDATE / DELETE · Seul l'administrateur lit, traite et efface les retours
drop policy if exists "Admin lit les retours" on public.feedback;
create policy "Admin lit les retours" on public.feedback
  for select to authenticated using (public.est_admin());
drop policy if exists "Admin traite les retours" on public.feedback;
create policy "Admin traite les retours" on public.feedback
  for update to authenticated using (public.est_admin()) with check (public.est_admin());
drop policy if exists "Admin efface les retours" on public.feedback;
create policy "Admin efface les retours" on public.feedback
  for delete to authenticated using (public.est_admin());

-- INSERT · L'app remonte ses erreurs automatiquement, au nom de la personne connectée ou anonymement
drop policy if exists "Signaler une erreur" on public.app_errors;
create policy "Signaler une erreur" on public.app_errors
  for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());
-- SELECT / DELETE · Seul l'administrateur les lit et les efface
drop policy if exists "Admin lit les erreurs" on public.app_errors;
create policy "Admin lit les erreurs" on public.app_errors
  for select to authenticated using (public.est_admin());
drop policy if exists "Admin efface les erreurs" on public.app_errors;
create policy "Admin efface les erreurs" on public.app_errors
  for delete to authenticated using (public.est_admin());

-- SELECT · Seul l'administrateur lit les lettres annuelles
drop policy if exists "Admin lit les lettres" on public.lettres;
create policy "Admin lit les lettres" on public.lettres
  for select to authenticated using (public.est_admin());
