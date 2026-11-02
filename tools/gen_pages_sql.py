#!/usr/bin/env python3
"""Generates V4__seed_pages.sql: the About and Members pages, summarised from the 2026 statutes (Arabic original).
French and English are working translations to be validated by ANAGEM; everything is editable in the admin (Homepage and pages)."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
out = root / "backend/src/main/resources/db/migration/V4__seed_pages.sql"

about = {
 "fr": {
  "title": "L'association",
  "intro": "L'Association Nationale des Géographes Marocains (ANAGEM) forme une organisation unique à l'échelle du Maroc. Son siège est à la Faculté des Lettres et des Sciences Humaines de Rabat ; des sections régionales peuvent être créées selon les besoins. Elle ne poursuit aucun but lucratif.",
  "objectivesTitle": "Nos objectifs",
  "objectives": [
   {"text": "Rassembler tous les géographes marocains et toutes les personnes qui s'intéressent à la géographie ou la soutiennent, au Maroc et à l'étranger."},
   {"text": "Réunir, diffuser et faire circuler l'information relative à la géographie du Maroc, au service de la recherche et de l'enseignement, pour contribuer au développement économique, social et culturel."},
   {"text": "Assurer la formation continue des membres de l'association."},
   {"text": "Développer les échanges, le dialogue et la communication entre les géographes marocains, les géographes d'autres pays et les spécialistes des sciences de la Terre et de l'Homme."},
   {"text": "Nouer et renforcer les liens avec les associations géographiques du Maghreb, du monde arabe et du reste du monde."},
   {"text": "Encourager les échanges et la coopération avec les associations nationales et étrangères poursuivant les mêmes objectifs."},
   {"text": "Organiser des manifestations scientifiques et culturelles : conférences, séminaires, journées d'étude, voyages et expositions."},
   {"text": "Faciliter la participation des membres aux manifestations scientifiques et culturelles au Maroc et à l'étranger."},
   {"text": "Enrichir en continu la bibliothèque de l'association, par échange ou don d'ouvrages, au service de la recherche et de la formation."}],
  "structureTitle": "Organisation",
  "bodies": [
   {"name": "Assemblée générale", "text": "Réunit tous les membres. Session ordinaire chaque année en novembre ; convocation au moins 15 jours à l'avance."},
   {"name": "Comité administratif national", "text": "Entre 21 et 31 membres issus de l'Assemblée générale, auxquels s'ajoutent les secrétaires généraux des sections. Mandat de trois ans."},
   {"name": "Bureau national", "text": "Neuf membres : président, secrétaire général, trésorier, rédacteur en chef de la revue, responsable de la communication et de la documentation, responsable des échanges, responsable des voyages et conseillers. Mandat de trois ans, renouvelable par tiers chaque année."},
   {"name": "Rédaction de la revue Géographie du Maroc", "text": "Entre cinq et sept membres, appuyés par un comité scientifique, chargés de collecter, évaluer et publier les articles."},
   {"name": "Sections régionales", "text": "Créées selon les besoins ; leur fonctionnement est fixé par un règlement intérieur."}],
  "common": {"statutesMediaId": None}
 },
 "ar": {
  "title": "الجمعية",
  "intro": "تشكّل الجمعية الوطنية للجغرافيين المغاربة تنظيمًا موحدًا على صعيد المغرب. مقرها بكلية الآداب والعلوم الإنسانية بالرباط، ويمكن إنشاء فروع جهوية حسب الحاجة. ولا تسعى الجمعية إلى تحقيق أي هدف تكسبي.",
  "objectivesTitle": "أهدافنا",
  "objectives": [
   {"text": "استقطاب كل الجغرافيين المغاربة وكل المهتمين بالجغرافيا والمتعاطفين معها، داخل المغرب وخارجه."},
   {"text": "جمع وتعميم وتداول المعلومات المتعلقة بجغرافية المغرب خدمةً للجغرافيا بحثًا وتدريسًا، بغية المساهمة في التنمية الاقتصادية والاجتماعية والثقافية."},
   {"text": "العمل على تثقيف وتكوين أعضاء الجمعية بكيفية مستمرة."},
   {"text": "تنمية التبادل والحوار والتواصل بين الجغرافيين المغاربة وجغرافيي البلاد الأخرى وكذا مع مختلف الاختصاصيين المهتمين بعلوم الأرض والإنسان."},
   {"text": "ربط الصلات وتوثيق العرى وتقوية العلائق مع الجمعيات الجغرافية بدول المغرب العربي والعالم العربي وباقي أقطار المعمور."},
   {"text": "تشجيع التبادل والحوار والتعاون مع الجمعيات الوطنية والأجنبية التي لها نفس الأهداف."},
   {"text": "تنظيم كل التظاهرات التي من شأنها أن تخدم هذه الأهداف، ومن أهمها الأنشطة العلمية والثقافية كالمحاضرات والندوات والأيام الدراسية والرحلات والمعارض."},
   {"text": "تسهيل وتشجيع مشاركة أعضاء الجمعية في التظاهرات العلمية والثقافية المنعقدة داخل المغرب وخارجه."},
   {"text": "السهر على التغذية المستمرة لخزانة الجمعية عن طريق التبادل أو إهداء الكتب خدمةً للبحث العلمي ومساهمةً في تكوين الطلبة والباحثين وكافة الأعضاء."}],
  "structureTitle": "التنظيم",
  "bodies": [
   {"name": "الجمع العام", "text": "يتركب من كل أعضاء الجمعية. ينعقد في جلسته العادية خلال شهر نونبر من كل سنة، ويُستدعى الأعضاء قبل 15 يومًا على الأقل."},
   {"name": "اللجنة الإدارية الوطنية", "text": "تتكون من 21 إلى 31 عضوًا ينبثقون عن الجمع العام، يضاف إليهم كتاب الفروع العامون. تُنتخب لمدة ثلاث سنوات."},
   {"name": "المكتب الوطني", "text": "يتكون من 9 أعضاء: الرئيس، الكاتب العام، أمين المال، رئيس تحرير المجلة، مسؤول عن نشرة الاتصال والتوثيق، مسؤول عن التبادل، مسؤول عن الرحلات، ومستشارون. يُنتخب لمدة ثلاث سنوات قابلة للتجديد بنسبة الثلث كل سنة."},
   {"name": "هيئة تحرير مجلة جغرافية المغرب", "text": "تتكون من خمسة أعضاء على الأقل وسبعة على الأكثر، بمساعدة لجنة علمية، وتتولى جمع مشاريع المقالات والبت في صلاحيتها للنشر."},
   {"name": "الفروع الجهوية", "text": "تُنشأ حسب الحاجة، ويحدد قانون داخلي كيفية تسييرها."}],
  "common": {"statutesMediaId": None}
 },
 "en": {
  "title": "The association",
  "intro": "The Moroccan National Association of Geographers (ANAGEM) is a single national organisation. Its seat is at the Faculty of Letters and Human Sciences in Rabat, and regional branches may be created as needed. The association pursues no profit-making purpose.",
  "objectivesTitle": "Our objectives",
  "objectives": [
   {"text": "Bring together all Moroccan geographers and everyone interested in or supportive of geography, in Morocco and abroad."},
   {"text": "Collect, spread and circulate information on the geography of Morocco in service of research and teaching, to contribute to economic, social and cultural development."},
   {"text": "Provide continuing education for the association's members."},
   {"text": "Develop exchange, dialogue and communication among Moroccan geographers, geographers of other countries and specialists in earth and human sciences."},
   {"text": "Build and strengthen ties with geographical associations in the Maghreb, the Arab world and elsewhere."},
   {"text": "Encourage exchange and cooperation with national and foreign associations pursuing the same objectives."},
   {"text": "Organise scientific and cultural events: lectures, seminars, study days, field trips and exhibitions."},
   {"text": "Facilitate members' participation in scientific and cultural events in Morocco and abroad."},
   {"text": "Keep enriching the association's library through exchange or donation of books, in service of research and training."}],
  "structureTitle": "Organisation",
  "bodies": [
   {"name": "General Assembly", "text": "Brings together all members. Ordinary session every year in November; members are convened at least 15 days ahead."},
   {"name": "National Administrative Committee", "text": "Between 21 and 31 members emerging from the General Assembly, plus the general secretaries of the branches. Three-year term."},
   {"name": "National Bureau", "text": "Nine members: president, secretary general, treasurer, editor-in-chief of the journal, communication and documentation officer, exchange officer, trips officer and advisers. Three-year term, one third renewed each year."},
   {"name": "Editorial board of Géographie du Maroc", "text": "Five to seven members, assisted by a scientific committee, in charge of collecting, reviewing and publishing articles."},
   {"name": "Regional branches", "text": "Created as needed; their operation is set by internal rules."}],
  "common": {"statutesMediaId": None}
 },
}

members = {
 "fr": {
  "title": "Membres",
  "intro": "L'ANAGEM réunit des géographes et des personnes attachées à la géographie. Les statuts prévoient plusieurs catégories de membres.",
  "categoriesTitle": "Catégories de membres",
  "categories": [
   {"name": "Membres actifs", "text": "Participent directement aux activités de l'association et s'acquittent de la cotisation annuelle fixée par l'Assemblée générale. Ils disposent du droit de vote."},
   {"name": "Membres correspondants", "text": "Personnes intéressées par les activités de l'association et lui apportant leur soutien moral, y compris hors du Maroc. Mêmes droits que les membres actifs, sauf le droit de vote."},
   {"name": "Membres d'honneur", "text": "Personnes ayant rendu service à la recherche géographique au Maroc ou contribué par leurs écrits ou leurs activités à faire connaître le Maroc, quelle que soit leur nationalité ou leur résidence. Choisis par le bureau."},
   {"name": "Étudiants", "text": "Peuvent adhérer en acquittant la cotisation annuelle fixée pour eux ; participent à toutes les activités, sans droit de vote."}],
  "joinTitle": "Comment adhérer",
  "join": "Tout géographe, chercheur ou enseignant, peut demander son adhésion auprès du secrétaire général de l'association. Pour les personnes qui ne sont pas géographes, l'admission dépend d'un vote positif au sein du bureau national ou des bureaux régionaux. Le montant de la cotisation annuelle est fixé par l'Assemblée générale.",
  "common": {}
 },
 "ar": {
  "title": "الأعضاء",
  "intro": "تضم الجمعية جغرافيين وأشخاصًا مهتمين بالجغرافيا. وينص القانون الأساسي على عدة فئات من الأعضاء.",
  "categoriesTitle": "فئات الأعضاء",
  "categories": [
   {"name": "الأعضاء النشيطون", "text": "يساهمون مباشرة في أنشطة الجمعية، وهم ملزمون بتسديد حق العضوية السنوي الذي يحدد قيمته الجمع العام. ولهم حق التصويت."},
   {"name": "الأعضاء المراسلون", "text": "أشخاص مهتمون بأنشطة الجمعية ويمدّونها بتأييدهم المعنوي ولو كانوا يقيمون خارج المغرب. يتمتعون بجميع حقوق العضو النشيط باستثناء حق التصويت."},
   {"name": "أعضاء الشرف", "text": "كل شخص أسدى خدمة للبحث الجغرافي بالمغرب أو ساهم بكتاباته أو أنشطته في التعريف بالمغرب، أيًّا كانت جنسيته ومكان إقامته. يقع اختيارهم من طرف المكتب."},
   {"name": "الطلبة", "text": "يمنح لهم حق العضوية بأداء مبلغ الاشتراك السنوي المحدد لهم، ويخولهم ذلك المساهمة في كافة أنشطة الجمعية دون حق التصويت."}],
  "joinTitle": "كيف تنخرط",
  "join": "تمنح الجمعية حق العضوية لكل جغرافي، باحثًا كان أم مدرسًا، بعد تقديم طلب في هذا الشأن إلى الأمين العام للجمعية. أما بالنسبة لغير الجغرافيين فإن قبولهم يتوقف على عملية تصويت إيجابي داخل المكتب الوطني أو المكاتب الجهوية. ويحدد الجمع العام قيمة حق العضوية السنوي.",
  "common": {}
 },
 "en": {
  "title": "Members",
  "intro": "ANAGEM brings together geographers and people committed to geography. The statutes provide for several categories of members.",
  "categoriesTitle": "Member categories",
  "categories": [
   {"name": "Active members", "text": "Take a direct part in the association's activities and pay the annual fee set by the General Assembly. They have the right to vote."},
   {"name": "Corresponding members", "text": "People interested in the association's activities who give it their moral support, including from outside Morocco. Same rights as active members except the right to vote."},
   {"name": "Honorary members", "text": "People who have served geographical research in Morocco or helped present Morocco through their writing or activities, whatever their nationality or residence. Chosen by the bureau."},
   {"name": "Students", "text": "May join by paying the annual fee set for them; they take part in all activities without the right to vote."}],
  "joinTitle": "How to join",
  "join": "Any geographer, researcher or teacher, may apply for membership to the association's secretary general. For people who are not geographers, admission depends on a positive vote within the national bureau or the regional bureaus. The amount of the annual fee is set by the General Assembly.",
  "common": {}
 },
}
legal = {l: {"title": t, "body": ""} for l, t in (("fr", "Mentions légales"), ("ar", "الإشعارات القانونية"), ("en", "Legal notices"))}
privacy = {l: {"title": t, "body": ""} for l, t in (("fr", "Protection des données"), ("ar", "حماية المعطيات"), ("en", "Data protection"))}
j = lambda o: "$j$ " + json.dumps(o, ensure_ascii=False) + " $j$::jsonb"
sql = ["-- Generated by tools/gen_pages_sql.py. About and Members pages summarised from the 2026 statutes (FR/EN = working translations to validate).\n",
       "insert into homepage_sections (section_key, enabled, sort_order, content) values\n"
       f"  ('PAGE_ABOUT', true, 100, {j(about)}),\n  ('PAGE_MEMBERS', true, 110, {j(members)}),\n  ('PAGE_LEGAL', true, 120, {j(legal)}),\n  ('PAGE_PRIVACY', true, 130, {j(privacy)});\n"]
out.write_text("\n".join(sql), encoding="utf-8")
print("written", out.name)
