/**
 * Populate a local development database with clearly labelled Theory Vault demo
 * material. This command is deliberately opt-in and refuses production hosts.
 *
 * Usage:
 *   pnpm seed:theory-demo
 *   pnpm seed:theory-demo --reset-demo
 */
import pool, { ensureSchema } from "../lib/db"

const DEMO_SOURCE = "Demo content — editorial review required"
const resetDemo = process.argv.includes("--reset-demo")

const collections = [
  { id: "theory-collection-end-of-rotation", slug: "end-of-rotation", title: "End of Rotation", sortOrder: 10 },
  { id: "theory-collection-end-of-year", slug: "end-of-year", title: "End of Year", sortOrder: 20 },
] as const

const disciplines = [
  { id: "theory-demo-discipline-cardiovascular-medicine", collectionId: collections[0].id, name: "Cardiovascular Medicine", sortOrder: 10 },
  { id: "theory-demo-discipline-community-medicine", collectionId: collections[0].id, name: "Community Medicine", sortOrder: 20 },
  { id: "theory-demo-discipline-pathology", collectionId: collections[1].id, name: "Pathology", sortOrder: 10 },
  { id: "theory-demo-discipline-pharmacology", collectionId: collections[1].id, name: "Pharmacology", sortOrder: 20 },
] as const

const sets = [
  { id: "theory-demo-set-acute-presentations", collectionId: collections[0].id, disciplineId: disciplines[0].id, name: "Set 1: Acute Presentations", sortOrder: 10 },
  { id: "theory-demo-set-core-public-health", collectionId: collections[0].id, disciplineId: disciplines[1].id, name: "Set 1: Core Public Health", sortOrder: 10 },
  { id: "theory-demo-set-cellular-injury-inflammation", collectionId: collections[1].id, disciplineId: disciplines[2].id, name: "Set 1: Cellular Injury and Inflammation", sortOrder: 10 },
  { id: "theory-demo-set-antimicrobials-safety", collectionId: collections[1].id, disciplineId: disciplines[3].id, name: "Set 1: Antimicrobials and Safety", sortOrder: 10 },
] as const

type Question = {
  id: string; collectionId: string; disciplineId: string; setId: string; prompt: string
  modelAnswer: string; markingPoints: string[]; tags: string[]; sortOrder: number; estimatedStudyMinutes: number
}

const questions: Question[] = [
  { id: "theory-demo-question-acute-pulmonary-oedema", collectionId: collections[0].id, disciplineId: disciplines[0].id, setId: sets[0].id, sortOrder: 10, estimatedStudyMinutes: 8, tags: ["demo", "cardiology", "emergency", "pulmonary oedema"], prompt: "Immediate assessment and management of acute pulmonary oedema", modelAnswer: "Demonstration material only — editorial review required. Use a structured ABCDE assessment, stabilise oxygenation and circulation, identify precipitating causes, and escalate promptly when there is respiratory failure, shock, or diagnostic uncertainty.", markingPoints: ["Perform an ABCDE assessment and call for senior help early.", "Assess oxygen saturation, respiratory effort, blood pressure, ECG, and bedside glucose.", "Sit the patient upright and give titrated oxygen only when clinically indicated.", "Treat congestion and address the precipitating cause while monitoring response."] },
  { id: "theory-demo-question-emergency-chest-pain", collectionId: collections[0].id, disciplineId: disciplines[0].id, setId: sets[0].id, sortOrder: 20, estimatedStudyMinutes: 8, tags: ["demo", "cardiology", "emergency", "chest pain"], prompt: "Structured emergency assessment of chest pain", modelAnswer: "Demonstration material only — editorial review required. Prioritise time-critical diagnoses while assessing stability, obtaining focused history and examination, ECG, and appropriate serial investigations.", markingPoints: ["Recognise instability and begin immediate resuscitation where required.", "Consider acute coronary syndrome, aortic dissection, pulmonary embolism, pneumothorax, and other critical differentials.", "Obtain and interpret an ECG promptly, repeating it if symptoms evolve.", "Use focused history, examination, and investigations to guide escalation and treatment."] },
  { id: "theory-demo-question-incidence-prevalence", collectionId: collections[0].id, disciplineId: disciplines[1].id, setId: sets[1].id, sortOrder: 10, estimatedStudyMinutes: 6, tags: ["demo", "public health", "epidemiology", "planning"], prompt: "Incidence versus prevalence in public health planning", modelAnswer: "Demonstration material only — editorial review required. Incidence measures new cases over time and helps assess risk or prevention needs; prevalence measures all existing cases and helps estimate service burden and resource requirements.", markingPoints: ["Define incidence as new cases in a population over a specified period.", "Define prevalence as all existing cases at a point or during a period.", "Explain how incidence informs prevention and risk assessment.", "Explain how prevalence informs workload, service capacity, and resource planning."] },
  { id: "theory-demo-question-food-borne-outbreak", collectionId: collections[0].id, disciplineId: disciplines[1].id, setId: sets[1].id, sortOrder: 20, estimatedStudyMinutes: 8, tags: ["demo", "public health", "outbreak investigation", "food safety"], prompt: "Investigation of a suspected food-borne disease outbreak", modelAnswer: "Demonstration material only — editorial review required. Verify the signal, protect the public, define and find cases, describe the outbreak by time, place, and person, generate and test hypotheses, and communicate findings with public-health partners.", markingPoints: ["Notify and coordinate with the appropriate public-health authority.", "Develop a working case definition and undertake active case finding.", "Describe cases by time, place, and person and generate hypotheses.", "Arrange appropriate environmental, food, and clinical sampling while implementing control measures."] },
  { id: "theory-demo-question-cell-injury", collectionId: collections[1].id, disciplineId: disciplines[2].id, setId: sets[2].id, sortOrder: 10, estimatedStudyMinutes: 7, tags: ["demo", "pathology", "cell injury", "inflammation"], prompt: "Reversible versus irreversible cell injury", modelAnswer: "Demonstration material only — editorial review required. Reversible injury reflects potentially recoverable cellular stress, whereas irreversible injury crosses a threshold of membrane and mitochondrial dysfunction that culminates in cell death.", markingPoints: ["Describe cellular swelling and fatty change as typical reversible patterns.", "Relate persistent ATP depletion and membrane damage to irreversible injury.", "Recognise severe mitochondrial dysfunction and loss of membrane integrity as key thresholds.", "Link irreversible injury to necrosis or apoptosis in the appropriate context."] },
  { id: "theory-demo-question-acute-inflammation", collectionId: collections[1].id, disciplineId: disciplines[2].id, setId: sets[2].id, sortOrder: 20, estimatedStudyMinutes: 7, tags: ["demo", "pathology", "acute inflammation", "signs"], prompt: "Cardinal signs and pathological basis of acute inflammation", modelAnswer: "Demonstration material only — editorial review required. Rubor, calor, tumour, dolor, and loss of function arise from coordinated vascular changes, increased permeability, inflammatory mediators, and tissue dysfunction.", markingPoints: ["Name rubor, calor, tumour, dolor, and loss of function.", "Relate redness and heat to vasodilation and increased blood flow.", "Relate swelling to increased vascular permeability and oedema.", "Relate pain and reduced function to mediators, pressure, and tissue injury."] },
  { id: "theory-demo-question-antimicrobial-prescribing", collectionId: collections[1].id, disciplineId: disciplines[3].id, setId: sets[3].id, sortOrder: 10, estimatedStudyMinutes: 7, tags: ["demo", "pharmacology", "antimicrobials", "stewardship"], prompt: "Principles of rational antimicrobial prescribing", modelAnswer: "Demonstration material only — editorial review required. Prescribing should be guided by a clear indication, likely pathogen and site, local guidance, patient factors, appropriate cultures, review, and the narrowest effective regimen for the shortest suitable duration.", markingPoints: ["Confirm a clinical indication and consider whether infection is likely.", "Select treatment using likely pathogens, site penetration, local guidance, and patient factors.", "Obtain relevant samples before treatment when this does not delay urgent care.", "Review results and response to de-escalate, stop, or tailor therapy."] },
  { id: "theory-demo-question-adverse-drug-reactions", collectionId: collections[1].id, disciplineId: disciplines[3].id, setId: sets[3].id, sortOrder: 20, estimatedStudyMinutes: 8, tags: ["demo", "pharmacology", "drug safety", "adverse drug reaction"], prompt: "Safe recognition and management of suspected adverse drug reactions", modelAnswer: "Demonstration material only — editorial review required. Assess severity and immediate risk, stop or withhold the suspected agent when appropriate, provide urgent supportive treatment, document clearly, and report serious reactions through local systems.", markingPoints: ["Assess airway, breathing, circulation, and features of severe hypersensitivity.", "Review the medication timeline, dose, interactions, and alternative causes.", "Stop or withhold the suspected medicine when clinically appropriate and treat urgent manifestations.", "Document the reaction and arrange appropriate reporting, follow-up, and patient counselling."] },
]

function productionEnvironment() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production" || process.env.NETLIFY_CONTEXT === "production"
}

function localDevelopmentEnvironment() {
  return !process.env.NODE_ENV || process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test"
}

async function seed() {
  if (productionEnvironment()) throw new Error("Refusing to seed Theory demonstration content in a production environment.")
  if (resetDemo && !localDevelopmentEnvironment()) throw new Error("--reset-demo is restricted to local or development databases.")
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) throw new Error("DATABASE_URL or POSTGRES_URL is required to seed Theory demonstration content.")

  await ensureSchema()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    if (resetDemo) await client.query("DELETE FROM mednexus_theory_collections WHERE id = ANY($1::text[])", [collections.map(collection => collection.id)])

    for (const collection of collections) await client.query(`INSERT INTO mednexus_theory_collections (id, slug, title, status, sort_order)
      VALUES ($1, $2, $3, 'published', $4)
      ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, title = EXCLUDED.title, status = EXCLUDED.status, sort_order = EXCLUDED.sort_order, updated_at = NOW()`, [collection.id, collection.slug, collection.title, collection.sortOrder])
    for (const discipline of disciplines) await client.query(`INSERT INTO mednexus_theory_disciplines (id, collection_id, name, sort_order) VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET collection_id = EXCLUDED.collection_id, name = EXCLUDED.name, sort_order = EXCLUDED.sort_order`, [discipline.id, discipline.collectionId, discipline.name, discipline.sortOrder])
    for (const set of sets) await client.query(`INSERT INTO mednexus_theory_sets (id, collection_id, discipline_id, name, sort_order) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET collection_id = EXCLUDED.collection_id, discipline_id = EXCLUDED.discipline_id, name = EXCLUDED.name, sort_order = EXCLUDED.sort_order`, [set.id, set.collectionId, set.disciplineId, set.name, set.sortOrder])
    for (const question of questions) await client.query(`INSERT INTO mednexus_theory_questions
      (id, collection_id, discipline_id, set_id, prompt, model_answer, key_marking_points, tags, source_metadata, difficulty, estimated_study_minutes, status, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, 3, $10, 'published', $11)
      ON CONFLICT (id) DO UPDATE SET collection_id = EXCLUDED.collection_id, discipline_id = EXCLUDED.discipline_id, set_id = EXCLUDED.set_id,
        prompt = EXCLUDED.prompt, model_answer = EXCLUDED.model_answer, key_marking_points = EXCLUDED.key_marking_points, tags = EXCLUDED.tags,
        source_metadata = EXCLUDED.source_metadata, difficulty = EXCLUDED.difficulty, estimated_study_minutes = EXCLUDED.estimated_study_minutes,
        status = EXCLUDED.status, sort_order = EXCLUDED.sort_order, updated_at = NOW()`,
      [question.id, question.collectionId, question.disciplineId, question.setId, question.prompt, question.modelAnswer, JSON.stringify(question.markingPoints), JSON.stringify(question.tags), JSON.stringify({ sourceTitle: DEMO_SOURCE, reference: DEMO_SOURCE }), question.estimatedStudyMinutes, question.sortOrder])
    await client.query("COMMIT")
    console.log(`Seeded ${collections.length} collections, ${disciplines.length} disciplines, ${sets.length} sets, and ${questions.length} published Theory demonstration questions${resetDemo ? " after reset" : ""}.`)
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally { client.release() }
}

seed().catch(error => { console.error("Theory demo seed failed.", error); process.exitCode = 1 }).finally(() => pool.end())
