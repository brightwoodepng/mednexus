export const THEORY_DEMO_SOURCE = "MedNexus demonstration content â€” editorial review required"

export const theoryDemoCollections = [
  { id: "theory-collection-end-of-module", slug: "end-of-module", title: "End of Module", kind: "end_of_module", sortOrder: 10 },
  { id: "theory-collection-end-of-year", slug: "end-of-year", title: "End of Year", kind: "end_of_year", sortOrder: 20 },
] as const

export const theoryDemoModules = [
  { id: "theory-demo-module-cardiovascular", collectionId: theoryDemoCollections[0].id, name: "Cardiovascular Medicine", description: "Teaching and consolidation questions for the cardiovascular module.", sortOrder: 10 },
  { id: "theory-demo-module-respiratory", collectionId: theoryDemoCollections[0].id, name: "Respiratory Medicine", description: "Teaching and consolidation questions for the respiratory module.", sortOrder: 20 },
  { id: "theory-demo-module-community", collectionId: theoryDemoCollections[0].id, name: "Community Medicine", description: "Teaching and consolidation questions for epidemiology and population health.", sortOrder: 30 },
] as const

export const theoryDemoDisciplines = [
  { id: "theory-demo-discipline-pathology", collectionId: theoryDemoCollections[1].id, name: "Pathology", sortOrder: 10 },
  { id: "theory-demo-discipline-pharmacology", collectionId: theoryDemoCollections[1].id, name: "Pharmacology", sortOrder: 20 },
  { id: "theory-demo-discipline-integrated", collectionId: theoryDemoCollections[1].id, name: "Integrated Clinical Reasoning", sortOrder: 30 },
] as const

export const theoryDemoSets = [
  { id: "theory-demo-set-cardiovascular-acute", collectionId: theoryDemoCollections[0].id, moduleId: theoryDemoModules[0].id, disciplineId: null, name: "Set 1: Acute Cardiovascular Presentations", description: "End-of-module teaching cases on common cardiovascular emergencies.", sortOrder: 10 },
  { id: "theory-demo-set-respiratory-breathlessness", collectionId: theoryDemoCollections[0].id, moduleId: theoryDemoModules[1].id, disciplineId: null, name: "Set 1: Breathlessness and Respiratory Disease", description: "End-of-module teaching cases covering acute and chronic respiratory presentations.", sortOrder: 10 },
  { id: "theory-demo-set-community-epidemiology", collectionId: theoryDemoCollections[0].id, moduleId: theoryDemoModules[2].id, disciplineId: null, name: "Set 1: Epidemiology and Population Health", description: "End-of-module questions on measures of disease, screening, and outbreaks.", sortOrder: 10 },
  { id: "theory-demo-set-pathology-foundations", collectionId: theoryDemoCollections[1].id, moduleId: null, disciplineId: theoryDemoDisciplines[0].id, name: "Set 1: Cell Injury, Inflammation and Repair", description: "End-of-year pathology questions testing mechanisms and application.", sortOrder: 10 },
  { id: "theory-demo-set-pharmacology-safety", collectionId: theoryDemoCollections[1].id, moduleId: null, disciplineId: theoryDemoDisciplines[1].id, name: "Set 1: Therapeutics and Medicines Safety", description: "End-of-year pharmacology questions on prescribing, kinetics, and safety.", sortOrder: 10 },
  { id: "theory-demo-set-integrated-final-review", collectionId: theoryDemoCollections[1].id, moduleId: null, disciplineId: theoryDemoDisciplines[2].id, name: "Set 1: Final Integrated Review", description: "End-of-year clinical reasoning cases across major systems.", sortOrder: 10 },
] as const

export type TheoryDemoQuestion = {
  id: string
  collectionId: string
  moduleId: string | null
  disciplineId: string | null
  setId: string
  title: string
  prompt: string
  modelAnswer: string
  markingPoints: string[]
  marks: number
  tags: string[]
  difficulty: number
  estimatedStudyMinutes: number
  sortOrder: number
}

function question(
  id: string,
  setIndex: number,
  order: number,
  title: string,
  prompt: string,
  modelAnswer: string,
  markingPoints: string[],
  tags: string[],
  options: { marks?: number; difficulty?: number; minutes?: number } = {},
): TheoryDemoQuestion {
  const set = theoryDemoSets[setIndex]
  return {
    id: `theory-demo-question-${id}`,
    collectionId: set.collectionId,
    moduleId: set.moduleId,
    disciplineId: set.disciplineId,
    setId: set.id,
    title,
    prompt,
    modelAnswer,
    markingPoints,
    marks: markingPoints.length * 2,
    tags: ["demo", ...tags],
    difficulty: options.difficulty ?? 3,
    estimatedStudyMinutes: options.minutes ?? 8,
    sortOrder: order * 10,
  }
}

export const theoryDemoQuestions: TheoryDemoQuestion[] = [
  question("acute-pulmonary-oedema", 0, 1, "Acute pulmonary oedema", "A 68-year-old patient presents with sudden severe breathlessness, widespread crackles, SpOâ‚‚ 84%, and blood pressure 190/110 mmHg. Outline your immediate assessment and management.", `## Immediate approach

Use an **ABCDE assessment**, call for senior help, sit the patient upright, attach continuous monitoring, and obtain intravenous access. Give oxygen when hypoxaemic and consider ventilatory support if respiratory distress persists.

## Focused management

- Obtain a 12-lead ECG, bedside glucose, blood tests, and portable chest imaging without delaying stabilisation.
- Treat congestion and severe hypertension according to local protocol, while monitoring blood pressure, urine output, symptoms, and oxygenation.
- Search for and treat the precipitant, including acute coronary syndrome, arrhythmia, infection, renal failure, or medication non-adherence.
- Escalate early for shock, exhaustion, altered consciousness, or failure to improve.

This is demonstration material for interface testing and requires local editorial review.`, ["Starts an ABCDE assessment and seeks senior help.", "Positions, monitors, and treats hypoxaemia appropriately.", "Uses focused investigations without delaying stabilisation.", "Treats congestion or severe hypertension under local guidance.", "Identifies and treats likely precipitants.", "States clear escalation criteria."], ["cardiology", "emergency", "pulmonary oedema"], { marks: 12, difficulty: 4, minutes: 10 }),
  question("acute-coronary-syndrome", 0, 2, "Suspected acute coronary syndrome", "Describe a safe early approach to a patient with ongoing central chest pain and new ischaemic ECG changes.", `Assess stability first and begin resuscitation if needed. Take a focused pain and cardiovascular history, examine the patient, obtain a prompt 12-lead ECG, and repeat it if symptoms evolve. Arrange serial cardiac biomarkers and baseline investigations.

Provide evidence-based initial therapy only after checking contraindications, bleeding risk, allergies, renal function, and the local acute coronary syndrome pathway. Discuss urgently with the appropriate cardiac service when there is persistent pain, haemodynamic compromise, malignant arrhythmia, or an ECG pattern requiring reperfusion.`, ["Recognises instability and starts immediate supportive care.", "Obtains and interprets an ECG promptly.", "Arranges serial biomarkers and relevant baseline tests.", "Checks contraindications before treatment.", "Activates the local reperfusion or cardiology pathway when indicated."], ["cardiology", "chest pain", "acute coronary syndrome"], { marks: 10, difficulty: 3 }),
  question("atrial-fibrillation", 0, 3, "New atrial fibrillation", "A patient has new atrial fibrillation with a ventricular rate of 150/min. Explain how haemodynamic stability changes your management.", `First decide whether the tachyarrhythmia is causing shock, myocardial ischaemia, syncope, or acute pulmonary oedema. An unstable patient needs urgent senior-led synchronised cardioversion under the local emergency protocol.

If stable, look for precipitants such as infection, thyrotoxicosis, electrolyte disturbance, alcohol use, hypoxia, or structural heart disease. Choose rate or rhythm control after considering symptom duration, comorbidity, ventricular function, and contraindications. Assess thromboembolic and bleeding risk separately; stroke prevention is not determined by whether rate control succeeds.`, ["Defines haemodynamic instability.", "States urgent synchronised cardioversion for instability.", "Searches for reversible precipitants.", "Explains rate-versus-rhythm considerations in stable patients.", "Assesses stroke and bleeding risk independently."], ["cardiology", "arrhythmia", "atrial fibrillation"], { marks: 10 }),
  question("hypertensive-emergency", 0, 4, "Hypertensive emergency", "Differentiate severe asymptomatic hypertension from hypertensive emergency and outline the management principle.", `Severe blood-pressure elevation alone is not a hypertensive emergency. The emergency is defined by **acute hypertension-mediated organ injury**, for example encephalopathy, acute pulmonary oedema, acute coronary syndrome, aortic syndrome, or acute kidney injury.

Confirm the measurement, assess symptoms and signs of organ injury, and investigate according to the suspected complication. In a true emergency, use monitored intravenous treatment with a condition-specific target and avoid an uncontrolled rapid fall in pressure. Without acute organ injury, address adherence and secondary factors and arrange safe oral treatment and follow-up rather than emergency intravenous reduction.`, ["Uses acute organ injury to define hypertensive emergency.", "Gives relevant examples of organ injury.", "Confirms measurement and performs targeted assessment.", "Uses monitored, condition-specific pressure reduction for emergency.", "Avoids rapid intravenous reduction when organ injury is absent."], ["cardiology", "hypertension", "emergency"], { marks: 10 }),

  question("acute-asthma", 1, 1, "Acute asthma severity", "Outline how you would assess severity and begin treatment in an adult with an acute asthma exacerbation.", `Assess speech, respiratory rate, pulse, oxygen saturation, peak expiratory flow where feasible, accessory muscle use, exhaustion, and mental state. A quiet chest, cyanosis, hypotension, exhaustion, or altered consciousness are life-threatening features.

Begin bronchodilator therapy and controlled oxygen as indicated by the local acute asthma pathway. Give systemic corticosteroid early and reassess frequently using both clinical findings and objective measures. Arrange blood gas testing and chest imaging selectively. Escalate urgently for life-threatening features, poor response, or impending respiratory failure.`, ["Assesses clinical and objective severity.", "Identifies life-threatening features.", "Starts bronchodilator and appropriate oxygen therapy.", "Gives systemic corticosteroid early.", "Reassesses response and escalates appropriately."], ["respiratory", "asthma", "emergency"], { marks: 10 }),
  question("copd-exacerbation", 1, 2, "COPD exacerbation", "A patient with COPD presents with increased breathlessness and sputum. Describe assessment, initial treatment, and indications for ventilatory support.", `Use ABCDE, establish the patient's usual oxygen target and baseline function, and look for pneumonia, pneumothorax, heart failure, pulmonary embolism, and medication problems. Give controlled oxygen to the individually appropriate target, bronchodilators, and systemic corticosteroid according to local guidance. Antibiotics depend on clinical evidence of bacterial infection and local policy.

Obtain an arterial or venous blood gas when significant illness or hypercapnia is possible. Consider non-invasive ventilation for persistent acute hypercapnic respiratory acidosis despite optimal initial therapy, provided there is no contraindication and appropriate monitoring is available.`, ["Uses ABCDE and considers important alternative diagnoses.", "Uses controlled oxygen with an appropriate target.", "Includes bronchodilator and corticosteroid treatment.", "Uses antibiotics selectively.", "Uses blood gases and states a sound indication for non-invasive ventilation."], ["respiratory", "COPD", "ventilation"], { marks: 10 }),
  question("community-pneumonia", 1, 3, "Community-acquired pneumonia", "Describe the assessment and early management of suspected community-acquired pneumonia, including how severity influences disposition.", `Confirm the syndrome with history, examination, oxygenation, and appropriate chest imaging. Assess severity with clinical judgement supported by a validated score, remembering that scores do not replace recognition of sepsis, hypoxaemia, decompensated comorbidity, or inability to manage at home.

Obtain microbiological samples when indicated without delaying time-critical antibiotics. Select antimicrobials using local guidance, allergy history, renal or hepatic function, and likely setting. Provide fluids, oxygen, analgesia, thromboprophylaxis, and organ support as needed. Reassess response and arrange follow-up of unresolved symptoms or radiographic abnormalities when appropriate.`, ["Confirms pneumonia and assesses oxygenation.", "Uses clinical judgement plus a validated severity tool.", "Recognises sepsis and social or comorbidity factors.", "Chooses antibiotics using local guidance and patient factors.", "Includes supportive care and reassessment."], ["respiratory", "pneumonia", "infection"], { marks: 10 }),
  question("pleural-effusion", 1, 4, "Pleural effusion evaluation", "Explain a structured approach to a newly identified unilateral pleural effusion.", `Assess respiratory compromise first, then use history, examination, prior imaging, and thoracic ultrasound to guide the differential. Common categories include infection, malignancy, heart failure, pulmonary embolism, and inflammatory disease.

When sampling is indicated, ultrasound-guided diagnostic aspiration should provide fluid for protein and LDH comparison, cell count, pH when infection is possible, microbiology, and cytology as appropriate. Interpret results in the clinical context and avoid procedures when the collection is too small or the risk outweighs benefit. Urgent drainage is considered for complicated infection or significant respiratory compromise under specialist guidance.`, ["Assesses compromise and builds an appropriate differential.", "Uses thoracic ultrasound.", "Lists appropriate pleural-fluid tests.", "Interprets results in clinical context.", "Recognises indications for urgent specialist drainage."], ["respiratory", "pleural effusion", "diagnostics"], { marks: 10 }),

  question("incidence-prevalence", 2, 1, "Incidence and prevalence", "Define incidence and prevalence. Explain how each measure helps a district health team plan services.", `**Incidence** measures new cases arising in a population at risk during a defined period. It is especially useful for studying risk, causation, prevention, and the speed at which disease is occurring.

**Prevalence** measures all existing cases in a population at a point in time or over a period. It reflects both incidence and disease duration, so it is useful for estimating service workload, medicine needs, staffing, and long-term care capacity.

A successful prevention programme may reduce incidence before prevalence falls, particularly when people already living with the condition survive for many years.`, ["Correctly defines incidence.", "Correctly defines point or period prevalence.", "Links incidence to risk and prevention.", "Links prevalence to service burden.", "Explains how disease duration affects prevalence."], ["community medicine", "epidemiology", "health planning"], { marks: 10, difficulty: 2, minutes: 6 }),
  question("outbreak-investigation", 2, 2, "Food-borne outbreak investigation", "Several students develop vomiting and diarrhoea after a school event. Outline the main steps of an outbreak investigation.", `Verify the diagnosis and confirm that cases exceed the expected level, while immediately controlling serious ongoing risks. Notify and coordinate with the relevant public-health authority.

Create a practical case definition, find cases actively, and describe them by time, place, and person. Construct a line list and epidemic curve, generate hypotheses about the source and transmission, and test them with an appropriate analytical study when needed. Collect clinical, food, water, and environmental samples carefully. Implement control measures as evidence develops, communicate with stakeholders, and document lessons after the outbreak.`, ["Verifies the signal and notifies public health.", "Creates a case definition and line list.", "Describes cases by time, place, and person.", "Generates and tests hypotheses.", "Coordinates sampling, control measures, and communication."], ["community medicine", "outbreak", "food safety"], { marks: 10 }),
  question("screening-programme", 2, 3, "Screening programme appraisal", "What features of a disease, screening test, and health system should be considered before introducing a population screening programme?", `The condition should be an important health problem with a detectable preclinical phase and a well-understood natural history. Earlier treatment should improve meaningful outcomes compared with usual clinical diagnosis.

The test should be sufficiently valid, reliable, acceptable, safe, and feasible. Cut-offs determine the balance between sensitivity and specificity, while predictive values depend strongly on prevalence.

The health system must be able to confirm diagnoses, provide effective treatment, assure quality, reach the target population equitably, handle false results, and monitor benefits and harms. The whole programmeâ€”not only the testâ€”must be affordable and sustainable.`, ["Addresses importance and natural history of the condition.", "Requires benefit from earlier treatment.", "Discusses validity, reliability, acceptability, and safety.", "Explains predictive values or sensitivity-specificity trade-offs.", "Considers capacity, equity, harms, quality assurance, and sustainability."], ["community medicine", "screening", "public health"], { marks: 10, difficulty: 3 }),
  question("study-design-bias", 2, 4, "Study design and bias", "Compare cohort and case-control studies and give one important source of bias for each.", `A **cohort study** starts with exposure status and follows participants to observe outcomes. It can estimate incidence and relative risk and is useful for uncommon exposures, but may be slow and vulnerable to loss-to-follow-up and exposure misclassification.

A **case-control study** starts with people who have an outcome and suitable controls, then looks back for exposure. It is efficient for rare outcomes or long latency and typically estimates an odds ratio. Its major vulnerabilities include selection of controls and differential recall of exposure.

In either design, confounding should be anticipated during design and addressed during analysis.`, ["Describes the direction of a cohort study.", "States a cohort strength and suitable measure.", "Describes the direction of a case-control study.", "States a case-control strength and suitable measure.", "Identifies relevant bias and mentions confounding."], ["community medicine", "study design", "bias"], { marks: 10 }),

  question("reversible-irreversible-injury", 3, 1, "Reversible and irreversible cell injury", "Compare the cellular changes of reversible injury with the key transitions to irreversible cell injury.", `Reversible injury follows limited or brief stress. ATP depletion disrupts ion pumps, producing cellular swelling; fatty change may occur, protein synthesis can fall, and membranes may show blebbing while overall integrity remains recoverable.

Irreversible injury follows severe or persistent damage. The critical transitions are failure to reverse mitochondrial dysfunction and profound loss of membrane integrity. Calcium influx, reactive oxygen species, lysosomal leakage, and enzyme activation amplify injury. The cell then dies through necrosis, apoptosis, or other regulated pathways depending on the stimulus and context.`, ["Explains ATP depletion and cellular swelling.", "Mentions fatty change or reduced protein synthesis.", "Identifies irreversible mitochondrial dysfunction.", "Identifies loss of membrane integrity.", "Links irreversible injury to cell-death pathways."], ["pathology", "cell injury", "cell death"], { marks: 10 }),
  question("acute-inflammation", 3, 2, "Acute inflammation", "Describe the vascular and cellular events of acute inflammation and relate them to the cardinal signs.", `Transient vasoconstriction is followed by arteriolar vasodilation, increasing flow and producing redness and heat. Increased microvascular permeability allows protein-rich fluid to enter tissues, causing swelling. Stasis promotes leukocyte margination.

Leukocytes roll through selectin interactions, adhere firmly through integrins, cross the endothelium, and migrate along chemotactic gradients. They recognise and phagocytose microbes or debris and kill them using lysosomal enzymes and reactive species. Mediators such as prostaglandins and bradykinin contribute to pain, while swelling and tissue injury impair function.`, ["Describes vasodilation and increased permeability.", "Relates vascular changes to redness, heat, and swelling.", "Describes rolling, adhesion, transmigration, and chemotaxis.", "Includes phagocytosis and microbial killing.", "Relates mediators to pain and loss of function."], ["pathology", "acute inflammation", "leukocytes"], { marks: 10 }),
  question("granulomatous-inflammation", 3, 3, "Granulomatous inflammation", "Define a granuloma, explain why it forms, and give important infectious and non-infectious causes.", `A granuloma is an organised collection of activated macrophages, often appearing as epithelioid cells and sometimes multinucleated giant cells, usually surrounded by lymphocytes and variable fibrosis.

It forms when the immune system attempts to contain a persistent agent that is difficult to eradicate. Causes include mycobacterial and some fungal infections, foreign material, sarcoidosis, Crohn disease, and selected occupational or immune-mediated conditions. Caseous necrosis can support an infectious differential but is not diagnostic by itself; morphology must be integrated with stains, culture or molecular tests, exposure history, and clinical findings.`, ["Defines the cellular structure of a granuloma.", "Explains containment of a persistent stimulus.", "Provides infectious examples.", "Provides non-infectious examples.", "Explains that morphology requires clinical and microbiological correlation."], ["pathology", "granuloma", "chronic inflammation"], { marks: 10 }),
  question("wound-healing", 3, 4, "Wound healing and complications", "Describe the overlapping phases of cutaneous wound healing and factors that can delay repair.", `Haemostasis begins immediately with vasoconstriction, platelet aggregation, and clot formation. Inflammation then removes microbes and damaged tissue. During proliferation, granulation tissue forms through angiogenesis and fibroblast activity; extracellular matrix is deposited and epithelium migrates. Remodelling reorganises collagen and increases tensile strength over weeks to months, although normal strength is never completely restored.

Healing is delayed by infection, poor perfusion, diabetes, malnutrition, glucocorticoids, repeated trauma, foreign material, and excessive tension. Complications include dehiscence, ulceration, hypertrophic scar, keloid, exuberant granulation tissue, and contracture.`, ["Describes haemostasis and inflammation.", "Describes granulation tissue, angiogenesis, and epithelialisation.", "Describes collagen remodelling and tensile strength.", "Lists important local and systemic delaying factors.", "Lists relevant healing complications."], ["pathology", "wound healing", "repair"], { marks: 10 }),

  question("antimicrobial-prescribing", 4, 1, "Rational antimicrobial prescribing", "Outline the principles of safe empirical antimicrobial prescribing and subsequent review.", `Confirm that bacterial infection is likely and identify the probable site, severity, and organisms. Obtain appropriate cultures before treatment when this will not delay urgent care. Choose the narrowest reasonable empirical regimen using local resistance data, allergy history, pregnancy status, interactions, organ function, recent antimicrobial exposure, and tissue penetration.

Document the indication, dose, route, review date, and intended duration. At 48â€“72 hoursâ€”or sooner when results arriveâ€”review cultures and clinical response. Stop if infection is unlikely, narrow or target therapy when possible, switch route when appropriate, control the source, and use the shortest effective duration.`, ["Confirms indication, site, severity, and likely organisms.", "Obtains cultures without delaying urgent treatment.", "Uses local guidance and patient-specific factors.", "Documents indication, review, and duration.", "Stops, narrows, targets, or switches therapy after review."], ["pharmacology", "antimicrobials", "stewardship"], { marks: 10 }),
  question("adverse-drug-reaction", 4, 2, "Suspected adverse drug reaction", "Describe a structured approach to recognising and managing a suspected adverse drug reaction.", `Assess severity and immediate threats first, especially anaphylaxis, severe cutaneous reactions, bleeding, arrhythmia, hepatic injury, and organ failure. Build a medication timeline including prescriptions, over-the-counter products, traditional remedies, recent dose changes, and interactions.

Stop or withhold the suspected medicine when the benefit-risk balance supports it, provide urgent supportive treatment, and consider safer alternatives. Use the timing, known reaction pattern, response to withdrawal, competing diagnoses, and objective tests to judge causality; deliberate re-challenge is rarely appropriate for serious reactions. Document the reaction precisely, counsel the patient, communicate it across care settings, and use the applicable pharmacovigilance reporting system.`, ["Assesses immediate severity.", "Constructs a complete medication timeline.", "Stops or withholds the drug when appropriate and treats the reaction.", "Uses a sound causality assessment.", "Documents, communicates, counsels, and reports."], ["pharmacology", "drug safety", "adverse drug reaction"], { marks: 10 }),
  question("renal-dose-adjustment", 4, 3, "Renal function and dose adjustment", "Explain why renal impairment can require medicine dose adjustment and distinguish changing the loading dose from changing the maintenance regimen.", `Reduced renal clearance can increase exposure and prolong half-life for a medicine or active metabolite, raising toxicity risk. Estimate kidney function using the measure recommended for that medicine, consider whether renal function is stable, and monitor concentration or effect when useful.

A **loading dose** mainly depends on the desired concentration and apparent volume of distribution, so it is often unchanged solely because clearance is reduced, although fluid status and distribution may alter it. The **maintenance dose or interval** depends strongly on clearance and commonly needs reduction or extension. Dialysis characteristics, therapeutic index, indication, and recovery or deterioration of kidney function all require repeated review.`, ["Links renal clearance to exposure, half-life, and toxicity.", "Uses the medicine-appropriate kidney function estimate.", "Explains the loading dose-volume relationship.", "Explains maintenance dose or interval adjustment.", "Considers dialysis, monitoring, and changing renal function."], ["pharmacology", "pharmacokinetics", "renal impairment"], { marks: 10, difficulty: 4 }),
  question("polypharmacy-review", 4, 4, "Structured polypharmacy review", "An older adult takes twelve regular medicines and reports falls and dizziness. Outline a patient-centred medication review.", `Start with the patient's goals, current symptoms, function, adherence, and what matters most to them. Reconcile every prescribed, over-the-counter, and complementary medicine, including actual dose and use.

For each medicine, confirm the indication, current benefit, time to benefit, dose, renal and hepatic suitability, interactions, duplication, monitoring, and adverse effects. Identify medicines that may contribute to hypotension, sedation, hypoglycaemia, bleeding, or anticholinergic burden. Agree changes through shared decision-making, usually one step at a time, with tapering where withdrawal is possible. Document the plan and arrange monitoring and follow-up.`, ["Elicits goals, symptoms, function, and adherence.", "Performs complete medicines reconciliation.", "Reviews indication, benefit, harm, dose, interactions, and monitoring.", "Links relevant medicines to falls and dizziness.", "Uses shared decisions, safe deprescribing, and follow-up."], ["pharmacology", "polypharmacy", "deprescribing"], { marks: 10 }),

  question("diabetic-ketoacidosis", 5, 1, "Diabetic ketoacidosis", "A young adult presents with vomiting, dehydration, glucose 28 mmol/L, ketonaemia, and metabolic acidosis. Outline priorities for diagnosis, treatment, and monitoring.", `Confirm diabetic ketoacidosis using the local biochemical criteria while applying ABCDE and looking for shock, altered consciousness, and a precipitating illness. Begin protocol-based isotonic fluid replacement and fixed-rate insulin, with potassium replacement guided by serial measurements and urine output. Continue necessary background insulin according to local guidance.

Monitor vital signs, fluid balance, glucose, ketones, electrolytes, venous pH or bicarbonate, and neurological state at the specified intervals. Add dextrose when glucose falls so insulin can continue to clear ketones. Search for infection, missed insulin, infarction, medicine triggers, or new diabetes. Avoid relying on glucose alone to judge resolution and escalate for severe electrolyte disturbance, cerebral oedema concern, pregnancy, or failure to improve.`, ["Confirms DKA and starts ABCDE assessment.", "Uses protocol-based fluid and fixed-rate insulin.", "Replaces potassium safely.", "Monitors ketones, acid-base status, glucose, electrolytes, and fluid balance.", "Identifies precipitants and clear escalation concerns."], ["integrated", "endocrinology", "DKA"], { marks: 12, difficulty: 4, minutes: 10 }),
  question("sepsis-recognition", 5, 2, "Sepsis with organ dysfunction", "A patient with suspected infection is confused, hypotensive, tachypnoeic, and oliguric. Describe the first-hour priorities and ongoing reassessment.", `Recognise possible sepsis with organ dysfunction, call for senior and critical-care support early, and use ABCDE. Obtain cultures and relevant laboratory tests, including lactate, without delaying time-critical antimicrobial therapy. Give oxygen when indicated and establish vascular access.

Start appropriate empirical antimicrobials using the suspected source, local guidance, allergies, and organ function. Give cautious, reassessed intravenous fluid boluses when hypoperfusion is present, watching for overload. Measure urine output, repeat perfusion assessment and lactate when appropriate, seek source control, and escalate for vasopressors or organ support when hypotension or hypoperfusion persists. Record response to each intervention rather than delivering an unexamined bundle.`, ["Recognises organ dysfunction and escalates early.", "Obtains cultures and lactate without delaying treatment.", "Starts source-appropriate antimicrobials.", "Uses reassessed fluid therapy and monitors for overload.", "Pursues source control and escalates persistent shock."], ["integrated", "infection", "sepsis"], { marks: 12, difficulty: 4, minutes: 10 }),
  question("microcytic-anaemia", 5, 3, "Microcytic anaemia", "A patient has fatigue, haemoglobin 8.5 g/dL, and low mean cell volume. Develop a differential diagnosis and investigation plan.", `Major causes include iron deficiency, thalassaemia, anaemia of chronic inflammation, and less commonly sideroblastic processes or lead exposure. Review dietary intake, menstrual and gastrointestinal blood loss, pregnancy, chronic inflammatory disease, family or ethnic history, medicines, and symptoms of malignancy or malabsorption.

Start with a blood film, reticulocyte count, ferritin, transferrin saturation or related iron studies, and markers of inflammation. Ferritin may be misleadingly normal or high during inflammation. Use haemoglobin analysis when a haemoglobinopathy is possible. Confirm the cause rather than simply prescribing iron, and investigate the source of iron deficiency according to age, sex, symptoms, and local guidance.`, ["Provides a focused differential diagnosis.", "Takes a history for blood loss, diet, inflammation, and inherited disease.", "Uses blood film, reticulocytes, and iron studies.", "Explains ferritin as an acute-phase reactant.", "Investigates the cause of confirmed iron deficiency."], ["integrated", "haematology", "anaemia"], { marks: 10 }),
  question("acute-kidney-injury", 5, 4, "Acute kidney injury", "A hospitalised patient's creatinine has doubled and urine output has fallen. Outline immediate assessment, classification, and management.", `Confirm the trend and severity, assess ABCDE, volume status, urine output, and complications such as hyperkalaemia, acidosis, pulmonary oedema, and uraemic symptoms. Compare with baseline and classify possible **pre-renal**, **intrinsic renal**, and **post-renal** causes.

Review sepsis, fluid losses, haemodynamics, recent contrast, medicines, urinalysis, and the clinical context. Stop or adjust nephrotoxic and renally cleared medicines when appropriate. Restore perfusion carefully when depleted, treat infection, relieve obstruction, and avoid both under-resuscitation and fluid overload. Arrange ultrasound when obstruction is possible and seek urgent renal advice for refractory hyperkalaemia, acidosis, overload, uraemic complications, rapidly progressive disease, or uncertainty.`, ["Assesses severity, urine output, and life-threatening complications.", "Uses pre-renal, intrinsic, and post-renal classification.", "Reviews medicines, urinalysis, haemodynamics, and infection.", "Treats the underlying cause and adjusts medicines.", "States appropriate imaging and urgent renal referral triggers."], ["integrated", "renal", "acute kidney injury"], { marks: 10, difficulty: 4 }),
]

export const theoryDemoSummary = {
  collections: theoryDemoCollections.length,
  modules: theoryDemoModules.length,
  disciplines: theoryDemoDisciplines.length,
  sets: theoryDemoSets.length,
  questions: theoryDemoQuestions.length,
}

