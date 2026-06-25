import type { Question, LabCategory } from "./types"

// ============================================================================
// MedNexus — QUESTIONS DATABASE
// ============================================================================
// This is the ONLY file you need to edit to:
//   • Add or remove entire modules (subjects)
//   • Add or remove individual questions
//   • Edit answer keys and explanations
//
// ── HOW MODULES WORK ─────────────────────────────────────────────────────────
// A "module" is just a unique `subject` string. There is no separate module
// registry. Simply:
//   • ADD a module     → write a question with a NEW subject string.
//                        The dashboard card appears automatically.
//   • DELETE a module  → remove (or comment out) every question that shares
//                        that subject string.
//   • RENAME a module  → find-and-replace the old subject string with the new
//                        one across all questions that use it.
//
// ── HOW TO ADD A QUESTION ────────────────────────────────────────────────────
// Copy the template below and paste it anywhere inside the array.
// The only rules:
//   1. `id`            must be unique across the whole array (e.g. "q13").
//   2. `subject`       must exactly match your module name (case-sensitive).
//   3. `correctAnswer` must match one of the option `id` values ("A"–"E").
//   4. Each option `id` must be unique within that question ("A", "B", "C" …).
//
// ── QUESTION TEMPLATE ────────────────────────────────────────────────────────
//
//  {
//    id: "q13",                          // <-- change to the next unique id
//    subject: "Cardiology",              // <-- module this belongs to
//    vignette:
//      "A 55-year-old man presents with …",   // clinical vignette text
//    options: [
//      { id: "A", text: "Option A text" },
//      { id: "B", text: "Option B text" },
//      { id: "C", text: "Option C text" },
//      { id: "D", text: "Option D text" },
//      // { id: "E", text: "Fifth option (optional)" },
//    ],
//    correctAnswer: "B",                 // <-- must match one option id above
//    explanation: {
//      objective:           "One sentence: what concept is being tested.",
//      details:             "Why the correct answer is correct. Be detailed.",
//      incorrectReasoning:  "Why each wrong choice is wrong.",
//    },
//  },
//
// ── HOW TO ADD A BRAND-NEW MODULE ────────────────────────────────────────────
// Just use a new subject string, e.g. "Rheumatology" or "Dermatology".
// Nothing else needs to change — a new dashboard card appears automatically.
//
// ── HOW TO DELETE A MODULE ───────────────────────────────────────────────────
// Delete (or comment out) every question that has that subject.
// The dashboard card disappears automatically.
//
// ── RUNNING LOCALLY ──────────────────────────────────────────────────────────
// See SETUP.md in the project root for full instructions.
// ============================================================================

export const questionsDatabase: Question[] = [

  // ==========================================================================
  // MODULE: Cardiology
  // ==========================================================================

  {
    id: "q1",
    subject: "Cardiology",
    vignette:
      "A 65-year-old male presents with sudden, severe tearing chest pain radiating to the back. Blood pressure is 190/110 mmHg in the right arm and 150/90 mmHg in the left arm. A widened mediastinum is seen on chest X-ray. Which of the following is the most appropriate initial pharmacologic therapy?",
    options: [
      { id: "A", text: "Lisinopril" },
      { id: "B", text: "Esmolol" },
      { id: "C", text: "Heparin" },
      { id: "D", text: "Nitroprusside alone" },
    ],
    correctAnswer: "B",
    explanation: {
      objective: "Understand acute aortic dissection management.",
      details:
        "Beta-blockers such as esmolol are first-line because they reduce both heart rate and the rate of rise of aortic pressure (dP/dt), limiting propagation of the dissection. Esmolol's short half-life allows rapid titration.",
      incorrectReasoning:
        "Heparin worsens bleeding into the false lumen and is contraindicated. Nitroprusside alone causes reflex tachycardia and increased dP/dt unless a beta-blocker is given first. Lisinopril acts too slowly for an acute emergency.",
    },
  },

  {
    id: "q2",
    subject: "Cardiology",
    vignette:
      "A 58-year-old woman with crushing substernal chest pain has an ECG showing 2 mm ST-segment elevation in leads II, III, and aVF. Which coronary artery is most likely occluded?",
    options: [
      { id: "A", text: "Left anterior descending artery" },
      { id: "B", text: "Left circumflex artery" },
      { id: "C", text: "Right coronary artery" },
      { id: "D", text: "Left main coronary artery" },
    ],
    correctAnswer: "C",
    explanation: {
      objective: "Localize myocardial infarction by ECG lead distribution.",
      details:
        "Leads II, III, and aVF represent the inferior wall, which in most people is supplied by the right coronary artery (RCA). Inferior STEMIs are frequently associated with bradycardia and heart block.",
      incorrectReasoning:
        "The LAD supplies the anterior wall (V1-V4). The circumflex supplies the lateral wall (I, aVL, V5-V6). Left main occlusion produces widespread changes and hemodynamic collapse.",
    },
  },

  // ==========================================================================
  // MODULE: Pulmonology
  // ==========================================================================

  {
    id: "q3",
    subject: "Pulmonology",
    vignette:
      "A 24-year-old woman presents with acute onset dyspnea and pleuritic chest pain three days after a long-haul flight. Heart rate is 118/min, and she has a swollen, tender right calf. Which of the following is the most appropriate next diagnostic step in a hemodynamically stable patient?",
    options: [
      { id: "A", text: "D-dimer assay" },
      { id: "B", text: "CT pulmonary angiography" },
      { id: "C", text: "Ventilation-perfusion (V/Q) scan" },
      { id: "D", text: "Lower extremity ultrasound only" },
    ],
    correctAnswer: "B",
    explanation: {
      objective: "Apply pretest probability to pulmonary embolism workup.",
      details:
        "With a high pretest probability (Wells score elevated by tachycardia, signs of DVT, and recent immobilization), CT pulmonary angiography is the test of choice to confirm pulmonary embolism.",
      incorrectReasoning:
        "D-dimer is useful only to rule out PE in low/intermediate probability patients; it is unhelpful when probability is high. V/Q scanning is reserved for patients who cannot receive contrast. Leg ultrasound alone does not evaluate the lungs.",
    },
  },

  {
    id: "q4",
    subject: "Pulmonology",
    vignette:
      "A 60-year-old man with a 40 pack-year smoking history has progressive dyspnea. Spirometry shows an FEV1/FVC ratio of 0.62 that does not improve after bronchodilator. Which of the following is the most likely diagnosis?",
    options: [
      { id: "A", text: "Asthma" },
      { id: "B", text: "Chronic obstructive pulmonary disease" },
      { id: "C", text: "Idiopathic pulmonary fibrosis" },
      { id: "D", text: "Congestive heart failure" },
    ],
    correctAnswer: "B",
    explanation: {
      objective: "Distinguish obstructive from restrictive lung disease.",
      details:
        "A post-bronchodilator FEV1/FVC < 0.70 that is largely irreversible in a heavy smoker is diagnostic of COPD.",
      incorrectReasoning:
        "Asthma shows significant bronchodilator reversibility. Pulmonary fibrosis is restrictive (normal or increased FEV1/FVC). CHF produces a restrictive-like pattern with other cardiac signs.",
    },
  },

  // ==========================================================================
  // MODULE: Neurology
  // ==========================================================================

  {
    id: "q5",
    subject: "Neurology",
    vignette:
      "A 70-year-old man develops sudden right-sided weakness and expressive aphasia. Symptoms began 90 minutes ago. A non-contrast head CT shows no hemorrhage. Which of the following is the most appropriate next step?",
    options: [
      { id: "A", text: "Administer intravenous alteplase (tPA)" },
      { id: "B", text: "Administer aspirin and observe" },
      { id: "C", text: "Start therapeutic heparin infusion" },
      { id: "D", text: "Obtain MRI before any treatment" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Manage acute ischemic stroke within the thrombolytic window.",
      details:
        "With symptom onset under 4.5 hours and hemorrhage excluded by CT, IV tPA is indicated to restore perfusion and improve functional outcomes.",
      incorrectReasoning:
        "Aspirin is given but only after tPA eligibility is decided (and delayed 24h if tPA is used). Heparin is not indicated acutely. Waiting for MRI would delay treatment past the therapeutic window.",
    },
  },

  {
    id: "q6",
    subject: "Neurology",
    vignette:
      "A 28-year-old woman reports episodes of unilateral throbbing headache preceded by flashing zig-zag lines, lasting several hours and accompanied by nausea and photophobia. Which of the following is the most appropriate abortive therapy?",
    options: [
      { id: "A", text: "Sumatriptan" },
      { id: "B", text: "Propranolol" },
      { id: "C", text: "High-flow oxygen" },
      { id: "D", text: "Topiramate" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Differentiate abortive from prophylactic migraine therapy.",
      details:
        "Sumatriptan, a 5-HT1B/1D agonist, is an effective abortive therapy for an acute migraine with aura.",
      incorrectReasoning:
        "Propranolol and topiramate are prophylactic agents, not abortive. High-flow oxygen is the treatment for cluster headache, not migraine.",
    },
  },

  // ==========================================================================
  // MODULE: Endocrinology
  // ==========================================================================

  {
    id: "q7",
    subject: "Endocrinology",
    vignette:
      "A 42-year-old woman has weight loss, palpitations, heat intolerance, and a fine tremor. Exam reveals a diffuse goiter and exophthalmos. Which laboratory pattern is most consistent with her diagnosis?",
    options: [
      { id: "A", text: "Low TSH, high free T4" },
      { id: "B", text: "High TSH, low free T4" },
      { id: "C", text: "High TSH, high free T4" },
      { id: "D", text: "Normal TSH, low free T4" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Interpret thyroid function tests in hyperthyroidism.",
      details:
        "Graves disease causes primary hyperthyroidism: increased thyroid hormone suppresses TSH, producing low TSH with high free T4. Exophthalmos and diffuse goiter are classic.",
      incorrectReasoning:
        "High TSH with low T4 indicates primary hypothyroidism. High TSH with high T4 suggests a TSH-secreting tumor or resistance. Normal TSH with low T4 is nonspecific.",
    },
  },

  {
    id: "q8",
    subject: "Endocrinology",
    vignette:
      "A 19-year-old with type 1 diabetes presents with nausea, abdominal pain, and Kussmaul respirations. Labs: glucose 480 mg/dL, pH 7.18, bicarbonate 12 mEq/L, positive serum ketones. After starting IV fluids, which electrolyte must be monitored most closely before and during insulin therapy?",
    options: [
      { id: "A", text: "Sodium" },
      { id: "B", text: "Potassium" },
      { id: "C", text: "Calcium" },
      { id: "D", text: "Magnesium" },
    ],
    correctAnswer: "B",
    explanation: {
      objective: "Manage electrolytes in diabetic ketoacidosis.",
      details:
        "Insulin drives potassium intracellularly and can precipitate life-threatening hypokalemia. Potassium must be checked first; if < 3.3 mEq/L, replace before starting insulin.",
      incorrectReasoning:
        "While sodium, calcium, and magnesium can shift, potassium carries the greatest acute arrhythmic risk during DKA treatment.",
    },
  },

  // ==========================================================================
  // MODULE: Gastroenterology
  // ==========================================================================

  {
    id: "q9",
    subject: "Gastroenterology",
    vignette:
      "A 45-year-old man with chronic alcohol use presents with severe epigastric pain radiating to the back and vomiting. Lipase is elevated five times the upper limit of normal. Which of the following is the most appropriate initial management?",
    options: [
      { id: "A", text: "Aggressive IV fluid resuscitation and analgesia" },
      { id: "B", text: "Immediate ERCP" },
      { id: "C", text: "Broad-spectrum prophylactic antibiotics" },
      { id: "D", text: "Urgent surgical debridement" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Outline initial management of acute pancreatitis.",
      details:
        "Acute pancreatitis is managed with aggressive IV fluids, analgesia, and bowel rest. Early fluid resuscitation reduces the risk of necrosis and organ failure.",
      incorrectReasoning:
        "ERCP is reserved for gallstone pancreatitis with cholangitis or obstruction. Prophylactic antibiotics are not recommended in the absence of infected necrosis. Surgery is not first-line.",
    },
  },

  {
    id: "q10",
    subject: "Gastroenterology",
    vignette:
      "A 30-year-old woman has recurrent bloody diarrhea, tenesmus, and crampy abdominal pain. Colonoscopy reveals continuous inflammation extending proximally from the rectum with no skip lesions. Which of the following is the most likely diagnosis?",
    options: [
      { id: "A", text: "Crohn disease" },
      { id: "B", text: "Ulcerative colitis" },
      { id: "C", text: "Ischemic colitis" },
      { id: "D", text: "Irritable bowel syndrome" },
    ],
    correctAnswer: "B",
    explanation: {
      objective: "Differentiate inflammatory bowel disease subtypes.",
      details:
        "Continuous inflammation beginning at the rectum and extending proximally without skip lesions is characteristic of ulcerative colitis, which is limited to the colon and mucosa.",
      incorrectReasoning:
        "Crohn disease shows skip lesions and transmural, often perianal, involvement. Ischemic colitis affects watershed areas in older patients. IBS produces no mucosal inflammation.",
    },
  },

  // ==========================================================================
  // MODULE: Nephrology
  // ==========================================================================

  {
    id: "q11",
    subject: "Nephrology",
    vignette:
      "A 68-year-old man hospitalized for pneumonia develops a rising creatinine after receiving IV contrast and gentamicin. Urinalysis shows muddy brown granular casts. Which of the following is the most likely cause of his acute kidney injury?",
    options: [
      { id: "A", text: "Prerenal azotemia" },
      { id: "B", text: "Acute tubular necrosis" },
      { id: "C", text: "Acute interstitial nephritis" },
      { id: "D", text: "Postrenal obstruction" },
    ],
    correctAnswer: "B",
    explanation: {
      objective: "Identify the cause of intrinsic acute kidney injury by urinary findings.",
      details:
        "Muddy brown granular casts are the hallmark of acute tubular necrosis, here precipitated by nephrotoxic contrast and aminoglycosides.",
      incorrectReasoning:
        "Prerenal azotemia shows bland sediment and a low FENa. Interstitial nephritis classically shows white cell casts and eosinophiluria. Obstruction is suggested by hydronephrosis on imaging.",
    },
  },

  // ==========================================================================
  // MODULE: Infectious Disease
  // ==========================================================================

  {
    id: "q12",
    subject: "Infectious Disease",
    vignette:
      "A 22-year-old college student presents with fever, severe headache, neck stiffness, and a petechial rash. CSF shows elevated protein, low glucose, and gram-negative diplococci. Which of the following is the most appropriate empiric therapy?",
    options: [
      { id: "A", text: "Ceftriaxone plus vancomycin" },
      { id: "B", text: "Acyclovir" },
      { id: "C", text: "Oral doxycycline" },
      { id: "D", text: "Fluconazole" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Select empiric therapy for bacterial meningitis.",
      details:
        "Gram-negative diplococci suggest Neisseria meningitidis. Empiric ceftriaxone plus vancomycin covers meningococcus and resistant pneumococcus pending cultures.",
      incorrectReasoning:
        "Acyclovir treats HSV encephalitis (lymphocytic CSF, normal glucose). Doxycycline and fluconazole do not cover acute bacterial meningitis adequately.",
    },
  },

  // ==========================================================================
  // MODULE: Hematology
  // ==========================================================================

  {
    id: "q13",
    subject: "Hematology",
    vignette:
      "A 35-year-old woman presents with fatigue, pallor, and a smooth, sore tongue. She has a history of heavy menstrual bleeding. Labs show hemoglobin 8.2 g/dL, MCV 72 fL, and low serum ferritin. Which of the following is the most appropriate treatment?",
    options: [
      { id: "A", text: "Oral iron supplementation" },
      { id: "B", text: "Vitamin B12 injections" },
      { id: "C", text: "Folic acid supplementation" },
      { id: "D", text: "Blood transfusion" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Diagnose and treat iron-deficiency anemia.",
      details:
        "Low ferritin confirms iron deficiency as the cause of microcytic anemia. Oral iron (ferrous sulfate) replaces iron stores and is first-line in stable patients. Dietary causes of menstrual blood loss should also be addressed.",
      incorrectReasoning:
        "B12 and folate deficiencies cause macrocytic anemia (high MCV). Blood transfusion is reserved for symptomatic severe anemia (Hgb < 7 g/dL) or cardiovascular compromise, not mild-to-moderate iron deficiency.",
    },
  },

  {
    id: "q14",
    subject: "Hematology",
    vignette:
      "A 55-year-old man with a history of deep vein thrombosis is found to have a prolonged aPTT that does not correct on mixing study. He has no current bleeding. Which of the following is the most likely underlying condition?",
    options: [
      { id: "A", text: "Hemophilia A" },
      { id: "B", text: "Antiphospholipid syndrome" },
      { id: "C", text: "Von Willebrand disease" },
      { id: "D", text: "Factor V Leiden mutation" },
    ],
    correctAnswer: "B",
    explanation: {
      objective: "Interpret a mixing study in a patient with prolonged aPTT.",
      details:
        "A prolonged aPTT that does not correct on 1:1 mixing indicates an inhibitor, not a factor deficiency. In the setting of thrombosis (not bleeding), the antiphospholipid antibody (lupus anticoagulant) is the classic cause — it paradoxically prolongs aPTT in vitro but causes thrombosis in vivo.",
      incorrectReasoning:
        "Hemophilia A corrects on mixing (factor deficiency). vWD usually affects bleeding time/ristocetin. Factor V Leiden causes thrombosis but does not prolong aPTT.",
    },
  },

  {
    id: "q15",
    subject: "Hematology",
    vignette:
      "A 7-year-old boy of African descent presents with severe bone pain, hand-foot swelling, and a hemoglobin of 7.5 g/dL. Peripheral smear shows sickle-shaped cells and target cells. Which of the following is the most effective long-term preventive therapy to reduce pain crises?",
    options: [
      { id: "A", text: "Hydroxyurea" },
      { id: "B", text: "Aspirin" },
      { id: "C", text: "Scheduled blood transfusions every 2 weeks" },
      { id: "D", text: "Deferoxamine" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Manage sickle cell disease with disease-modifying therapy.",
      details:
        "Hydroxyurea increases fetal hemoglobin (HbF), which does not participate in sickling. It reduces the frequency of painful crises, acute chest syndrome, and hospitalizations and is first-line for moderate-to-severe sickle cell disease.",
      incorrectReasoning:
        "Aspirin does not prevent sickling. Chronic transfusions are used for stroke prevention, not routine crisis prophylaxis, and carry iron overload risk. Deferoxamine chelates iron but does not prevent sickling.",
    },
  },

  // ==========================================================================
  // MODULE: Psychiatry
  // ==========================================================================

  {
    id: "q16",
    subject: "Psychiatry",
    vignette:
      "A 26-year-old woman presents with a 3-week history of depressed mood, anhedonia, insomnia, fatigue, and feelings of worthlessness. She denies suicidal ideation and has no prior psychiatric history. Which of the following is the most appropriate first-line treatment?",
    options: [
      { id: "A", text: "Selective serotonin reuptake inhibitor (SSRI)" },
      { id: "B", text: "Monoamine oxidase inhibitor (MAOI)" },
      { id: "C", text: "Lithium" },
      { id: "D", text: "Haloperidol" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Select first-line pharmacotherapy for major depressive disorder.",
      details:
        "SSRIs (e.g., sertraline, fluoxetine) are first-line for major depressive disorder due to their favorable efficacy/side-effect profile. Symptoms must persist ≥2 weeks and include ≥5 DSM-5 criteria to diagnose MDD.",
      incorrectReasoning:
        "MAOIs require strict dietary tyramine restriction and have many drug interactions — reserved for refractory cases. Lithium is for bipolar disorder. Haloperidol is an antipsychotic not indicated for uncomplicated MDD.",
    },
  },

  {
    id: "q17",
    subject: "Psychiatry",
    vignette:
      "A 30-year-old man is brought to the ED after police found him in the street, speaking rapidly, claiming he has special powers and has not slept for 4 days. He has pressured speech and grandiose delusions. He had a similar episode 2 years ago followed by a 6-month depressive episode. Which diagnosis best fits this presentation?",
    options: [
      { id: "A", text: "Schizophrenia" },
      { id: "B", text: "Bipolar I disorder, manic episode" },
      { id: "C", text: "Schizoaffective disorder" },
      { id: "D", text: "Stimulant intoxication only" },
    ],
    correctAnswer: "B",
    explanation: {
      objective: "Diagnose bipolar I disorder based on DSM-5 criteria.",
      details:
        "Bipolar I requires at least one manic episode lasting ≥7 days (or hospitalization). Classic features include decreased sleep, grandiosity, pressured speech, and racing thoughts. The history of a prior depressive episode is consistent but not required for the diagnosis.",
      incorrectReasoning:
        "Schizophrenia features psychosis without prominent mood episodes. Schizoaffective disorder requires psychotic symptoms independent of mood episodes for ≥2 weeks. Stimulant intoxication is possible but cannot account for the prior course.",
    },
  },

  {
    id: "q18",
    subject: "Psychiatry",
    vignette:
      "A 22-year-old college student has recurrent intrusive thoughts about contamination and performs hand-washing rituals up to 50 times a day, causing significant distress and interfering with school. He recognizes the thoughts are irrational. Which of the following is the most appropriate treatment?",
    options: [
      { id: "A", text: "Exposure and response prevention (ERP) ± SSRI" },
      { id: "B", text: "Benzodiazepine therapy" },
      { id: "C", text: "Supportive psychotherapy alone" },
      { id: "D", text: "Antipsychotic monotherapy" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Treat obsessive-compulsive disorder with evidence-based therapies.",
      details:
        "ERP (a form of CBT) is first-line psychotherapy for OCD and is often combined with a high-dose SSRI (e.g., fluvoxamine, fluoxetine). ERP involves deliberate exposure to feared stimuli while refraining from compulsive rituals.",
      incorrectReasoning:
        "Benzodiazepines reduce anxiety short-term but perpetuate OCD by reinforcing avoidance. Supportive psychotherapy alone is insufficient for moderate-severe OCD. Antipsychotics are adjuncts in refractory cases, not monotherapy.",
    },
  },

  // ==========================================================================
  // MODULE: Dermatology
  // ==========================================================================

  {
    id: "q19",
    subject: "Dermatology",
    vignette:
      "A 72-year-old man with a 50-pack-year smoking history presents with a pearly, translucent papule with rolled borders and central ulceration on his nose. He has had the lesion for over a year. Which of the following is the most likely diagnosis?",
    options: [
      { id: "A", text: "Squamous cell carcinoma" },
      { id: "B", text: "Basal cell carcinoma" },
      { id: "C", text: "Melanoma" },
      { id: "D", text: "Seborrheic keratosis" },
    ],
    correctAnswer: "B",
    explanation: {
      objective: "Recognize the classic presentation of basal cell carcinoma.",
      details:
        "Basal cell carcinoma (BCC) is the most common skin cancer. It presents as a pearly papule with rolled edges, telangiectasias, and central ulceration on sun-exposed areas in fair-skinned individuals. Despite local invasion, it rarely metastasizes.",
      incorrectReasoning:
        "SCC typically appears as a scaly, erythematous, indurated plaque and has higher metastatic potential. Melanoma shows pigment variation and the ABCDEs. Seborrheic keratosis is benign, waxy, 'stuck-on' appearing, not ulcerated.",
    },
  },

  {
    id: "q20",
    subject: "Dermatology",
    vignette:
      "A 16-year-old girl presents with erythematous, scaly plaques with well-defined borders on her elbows and scalp. She also has pitting of her fingernails. Which of the following is the most appropriate initial topical treatment?",
    options: [
      { id: "A", text: "High-potency topical corticosteroid" },
      { id: "B", text: "Topical antifungal" },
      { id: "C", text: "Topical antibiotic" },
      { id: "D", text: "Calcineurin inhibitor" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Manage mild-to-moderate plaque psoriasis.",
      details:
        "Plaque psoriasis presents with well-demarcated, silvery-scaled erythematous plaques on extensor surfaces and scalp. Nail pitting is a characteristic feature. High-potency topical corticosteroids are first-line for limited disease.",
      incorrectReasoning:
        "Antifungals treat tinea, which lacks nail pitting and has a scaly, central clearing pattern. Antibiotics address bacterial infections. Calcineurin inhibitors are useful on the face/skin folds but not as first-line for plaques.",
    },
  },

  // ==========================================================================
  // MODULE: Rheumatology
  // ==========================================================================

  {
    id: "q21",
    subject: "Rheumatology",
    vignette:
      "A 45-year-old woman presents with 6 weeks of symmetric morning stiffness in her fingers lasting more than one hour, bilateral metacarpophalangeal swelling, and fatigue. RF and anti-CCP antibodies are positive. Which of the following is the most appropriate initial disease-modifying therapy?",
    options: [
      { id: "A", text: "Methotrexate" },
      { id: "B", text: "Prednisone monotherapy" },
      { id: "C", text: "Celecoxib" },
      { id: "D", text: "Hydroxychloroquine alone" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Initiate DMARD therapy for seropositive rheumatoid arthritis.",
      details:
        "Methotrexate is the anchor DMARD for rheumatoid arthritis. It slows radiographic progression, reduces joint damage, and is the cornerstone of RA management. Folic acid supplementation is given concurrently to reduce toxicity.",
      incorrectReasoning:
        "Prednisone provides symptom relief but does not modify disease course and causes long-term harm. Celecoxib is symptomatic only. Hydroxychloroquine is used in milder disease or SLE, not as the primary DMARD in seropositive RA.",
    },
  },

  {
    id: "q22",
    subject: "Rheumatology",
    vignette:
      "A 28-year-old woman presents with a malar rash, oral ulcers, arthritis, and a positive ANA titer of 1:640. She has recently noted darker urine. Urinalysis shows RBC casts and 3+ proteinuria. Which of the following best describes this complication?",
    options: [
      { id: "A", text: "Lupus nephritis" },
      { id: "B", text: "IgA nephropathy" },
      { id: "C", text: "Minimal change disease" },
      { id: "D", text: "Renal artery stenosis" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Recognize lupus nephritis in systemic lupus erythematosus.",
      details:
        "Lupus nephritis is a serious complication of SLE presenting with hematuria, RBC casts (nephritic), and proteinuria. The malar rash, oral ulcers, arthritis, and high ANA titer confirm SLE. Renal biopsy guides class-specific therapy (e.g., mycophenolate for Class III/IV).",
      incorrectReasoning:
        "IgA nephropathy follows upper respiratory infection in younger patients without systemic lupus features. Minimal change disease presents with heavy proteinuria/nephrotic syndrome, not RBC casts. Renal artery stenosis causes hypertension, not nephritis.",
    },
  },

  // ==========================================================================
  // MODULE: Orthopedics
  // ==========================================================================

  {
    id: "q23",
    subject: "Orthopedics",
    vignette:
      "A 70-year-old woman with osteoporosis slips on ice and is now unable to bear weight. X-ray shows a fracture of the femoral neck. She is otherwise healthy. Which of the following is the most appropriate management?",
    options: [
      { id: "A", text: "Hemiarthroplasty or total hip replacement" },
      { id: "B", text: "Conservative management with bed rest" },
      { id: "C", text: "Intramedullary nailing" },
      { id: "D", text: "Cannulated screw fixation" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Manage displaced femoral neck fracture in an elderly patient.",
      details:
        "Displaced femoral neck fractures in elderly patients have a high risk of avascular necrosis due to disruption of the blood supply. Hemiarthroplasty (replacing only the femoral head) or total hip replacement (for active patients with acetabular disease) provides faster mobilization and lower failure rates than internal fixation.",
      incorrectReasoning:
        "Bed rest risks immobility complications in the elderly. Intramedullary nailing is for intertrochanteric fractures, not femoral neck. Cannulated screws can be used in young patients with non-displaced fractures, not displaced fractures in the elderly.",
    },
  },

  {
    id: "q24",
    subject: "Orthopedics",
    vignette:
      "A 22-year-old basketball player hears a 'pop' and feels the knee give way after a non-contact pivot. Examination reveals a positive Lachman test and anterior drawer sign. MRI confirms the diagnosis. Which structure is most likely injured?",
    options: [
      { id: "A", text: "Medial collateral ligament" },
      { id: "B", text: "Anterior cruciate ligament" },
      { id: "C", text: "Posterior cruciate ligament" },
      { id: "D", text: "Lateral meniscus" },
    ],
    correctAnswer: "B",
    explanation: {
      objective: "Diagnose anterior cruciate ligament injury.",
      details:
        "ACL tears classically occur with non-contact deceleration or pivoting. A positive Lachman test (most sensitive) and anterior drawer sign confirm anterior tibial displacement relative to the femur. MRI confirms the tear and evaluates associated meniscal injuries.",
      incorrectReasoning:
        "MCL injury causes medial joint line tenderness and valgus instability. PCL injury produces a positive posterior drawer sign. Lateral meniscal tears cause lateral pain and may produce a McMurray click, but do not cause anterior laxity.",
    },
  },

  // ==========================================================================
  // MODULE: OB/GYN
  // ==========================================================================

  {
    id: "q25",
    subject: "OB/GYN",
    vignette:
      "A 28-year-old G1P0 woman at 32 weeks gestation presents with sudden, painless bright red vaginal bleeding. Fetal heart tracing is reassuring. Ultrasound reveals the placenta covering the internal cervical os. Which is the most appropriate immediate management?",
    options: [
      { id: "A", text: "Expectant management, pelvic rest, and hospitalization" },
      { id: "B", text: "Immediate cesarean delivery" },
      { id: "C", text: "Amniotomy to assess for cord prolapse" },
      { id: "D", text: "Digital cervical examination" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Manage placenta previa in a preterm patient with stable bleeding.",
      details:
        "Placenta previa presents with painless bright-red vaginal bleeding, typically in the third trimester. With stable mother and fetus at 32 weeks, expectant management with hospitalization, pelvic rest, corticosteroids for fetal lung maturity, and close monitoring is appropriate. Delivery is planned at 36-37 weeks.",
      incorrectReasoning:
        "Immediate cesarean is indicated for uncontrolled hemorrhage or fetal compromise. Amniotomy is contraindicated. Digital cervical examination is absolutely contraindicated as it can trigger catastrophic hemorrhage by disrupting the placenta.",
    },
  },

  {
    id: "q26",
    subject: "OB/GYN",
    vignette:
      "A 34-year-old woman presents with severe right lower quadrant pain and vaginal spotting. Her last menstrual period was 7 weeks ago. Serum β-hCG is 2,800 mIU/mL, and transvaginal ultrasound shows no intrauterine gestational sac. Which of the following is the most likely diagnosis?",
    options: [
      { id: "A", text: "Complete abortion" },
      { id: "B", text: "Ectopic pregnancy" },
      { id: "C", text: "Corpus luteum cyst" },
      { id: "D", text: "Appendicitis" },
    ],
    correctAnswer: "B",
    explanation: {
      objective: "Diagnose ectopic pregnancy using β-hCG and ultrasound.",
      details:
        "An ectopic pregnancy is suspected when β-hCG exceeds the discriminatory zone (~1,500–2,000 mIU/mL) with no intrauterine pregnancy on ultrasound. Right lower quadrant pain with spotting and amenorrhea completes the classic triad. Urgent management with methotrexate or surgery is required.",
      incorrectReasoning:
        "Complete abortion has passed products of conception and declining β-hCG. Corpus luteum cysts can cause pain but are benign adnexal findings; β-hCG would normally be in a viable IUP. Appendicitis does not cause vaginal bleeding or elevated β-hCG.",
    },
  },

  // ==========================================================================
  // MODULE: Pediatrics
  // ==========================================================================

  {
    id: "q27",
    subject: "Pediatrics",
    vignette:
      "A 2-year-old boy presents with 3 days of high fever, irritability, and a strawberry tongue. He has bilateral conjunctival injection, erythematous cracked lips, and a polymorphous rash on the trunk. Cervical lymphadenopathy is present. Which of the following is the most serious potential complication if left untreated?",
    options: [
      { id: "A", text: "Rheumatic heart disease" },
      { id: "B", text: "Coronary artery aneurysms" },
      { id: "C", text: "Nephrotic syndrome" },
      { id: "D", text: "Subacute sclerosing panencephalitis" },
    ],
    correctAnswer: "B",
    explanation: {
      objective: "Recognize Kawasaki disease and its cardiac complications.",
      details:
        "Kawasaki disease presents with ≥5 days of fever plus ≥4 of 5 criteria (conjunctivitis, oral changes, rash, extremity changes, cervical lymphadenopathy). The most serious complication without treatment is coronary artery aneurysms. IV immunoglobulin + aspirin reduces this risk significantly.",
      incorrectReasoning:
        "Rheumatic heart disease follows Group A streptococcal infection, not Kawasaki disease. Nephrotic syndrome is not a feature of Kawasaki. SSPE is a late complication of measles infection.",
    },
  },

  {
    id: "q28",
    subject: "Pediatrics",
    vignette:
      "A 6-week-old male infant presents with progressively worsening projectile, non-bilious vomiting after feeds for 2 weeks. He appears hungry after vomiting. Exam reveals a small olive-shaped mass in the epigastrium. Which of the following is the most likely diagnosis?",
    options: [
      { id: "A", text: "Pyloric stenosis" },
      { id: "B", text: "Duodenal atresia" },
      { id: "C", text: "Intussusception" },
      { id: "D", text: "Gastroesophageal reflux" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Diagnose hypertrophic pyloric stenosis in a neonate.",
      details:
        "Pyloric stenosis classically presents at 3-6 weeks of age with progressive projectile non-bilious vomiting. The infant remains hungry ('hungry vomiter'). A palpable olive-shaped epigastric mass and hypochloremic hypokalemic metabolic alkalosis (from loss of HCl) are classic. Ultrasound confirms the diagnosis; pyloromyotomy is curative.",
      incorrectReasoning:
        "Duodenal atresia presents at birth with bilious vomiting and double-bubble sign on X-ray. Intussusception occurs at 6 months to 2 years with colicky pain and currant jelly stools. GERD produces non-projectile regurgitation without the olive mass or metabolic derangement.",
    },
  },

  // ==========================================================================
  // MODULE: Pharmacology
  // ==========================================================================

  {
    id: "q29",
    subject: "Pharmacology",
    vignette:
      "A patient taking warfarin for atrial fibrillation is started on fluconazole for a fungal infection. Three days later she presents with a significantly elevated INR and hematuria. Which mechanism best explains this interaction?",
    options: [
      { id: "A", text: "Fluconazole inhibits CYP2C9, reducing warfarin metabolism" },
      { id: "B", text: "Fluconazole induces CYP3A4, increasing warfarin clearance" },
      { id: "C", text: "Fluconazole displaces warfarin from albumin binding sites" },
      { id: "D", text: "Fluconazole decreases vitamin K absorption" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Identify clinically important cytochrome P450 drug interactions with warfarin.",
      details:
        "Warfarin (specifically the S-enantiomer) is metabolized primarily by CYP2C9. Fluconazole is a potent CYP2C9 inhibitor, leading to decreased warfarin metabolism, drug accumulation, elevated INR, and bleeding risk. Dose reduction or alternative antifungal should be considered.",
      incorrectReasoning:
        "CYP3A4 inducers (e.g., rifampin) increase warfarin clearance and lower INR. Protein displacement is a transient effect. Fluconazole does not significantly affect vitamin K absorption.",
    },
  },

  {
    id: "q30",
    subject: "Pharmacology",
    vignette:
      "A 62-year-old man with chronic kidney disease is started on metformin for type 2 diabetes. Which of the following is the primary reason metformin is contraindicated in severe renal impairment (eGFR < 30 mL/min/1.73m²)?",
    options: [
      { id: "A", text: "Risk of lactic acidosis due to drug accumulation" },
      { id: "B", text: "Nephrotoxicity from metformin itself" },
      { id: "C", text: "Increased risk of hypoglycemia" },
      { id: "D", text: "Interference with creatinine measurement" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Understand the renal contraindication to metformin.",
      details:
        "Metformin is renally cleared. In severe CKD, drug accumulates and increases anaerobic glycolysis, raising lactate levels and causing lactic acidosis — a rare but potentially fatal complication. Metformin is generally safe with eGFR ≥ 45 and should be withheld perioperatively or prior to IV contrast.",
      incorrectReasoning:
        "Metformin itself is not nephrotoxic. It does not cause hypoglycemia as it does not stimulate insulin secretion. While metformin slightly elevates creatinine (by inhibiting tubular secretion), this is not the primary contraindication.",
    },
  },

  // ==========================================================================
  // MODULE: Neurology
  // ==========================================================================

  {
    id: "q31",
    subject: "Neurology",
    vignette:
      "A 65-year-old man with hypertension and diabetes presents with sudden loss of vision in his right eye lasting 15 minutes, then fully resolving. He denies headache. Carotid duplex shows 80% right internal carotid artery stenosis. What is the most likely diagnosis and most appropriate intervention?",
    options: [
      { id: "A", text: "Amaurosis fugax; carotid endarterectomy" },
      { id: "B", text: "Migraine with aura; sumatriptan" },
      { id: "C", text: "Retinal artery occlusion; ophthalmologic observation" },
      { id: "D", text: "Multiple sclerosis; interferon-beta" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Recognize amaurosis fugax as a TIA equivalent requiring urgent carotid evaluation.",
      details:
        "Amaurosis fugax (transient monocular blindness) is a TIA of the ophthalmic artery, commonly caused by emboli from ipsilateral carotid stenosis. With symptomatic stenosis >70%, carotid endarterectomy significantly reduces stroke risk and is the standard of care.",
      incorrectReasoning:
        "Migraine aura typically involves binocular visual phenomena with headache. Permanent retinal artery occlusion does not resolve within minutes. MS can cause monocular vision loss (optic neuritis) but is painful, lasts days to weeks, and is not associated with carotid stenosis.",
    },
  },

  // ==========================================================================
  // MODULE: Cardiology
  // ==========================================================================

  {
    id: "q32",
    subject: "Cardiology",
    vignette:
      "A 72-year-old man presents with exertional syncope, dyspnea on exertion, and angina. On auscultation a harsh crescendo-decrescendo systolic murmur is heard best at the right second intercostal space, radiating to the carotids. Which of the following is the most appropriate next step?",
    options: [
      { id: "A", text: "Echocardiography" },
      { id: "B", text: "Exercise stress test" },
      { id: "C", text: "Coronary angiography" },
      { id: "D", text: "Start ACE inhibitor" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Evaluate suspected severe aortic stenosis.",
      details:
        "The classic triad of aortic stenosis — syncope, angina, and heart failure — combined with a systolic crescendo-decrescendo murmur at the right upper sternal border radiating to carotids strongly suggests severe AS. Echocardiography confirms the diagnosis, quantifies valve area and gradient, and guides timing of valve replacement.",
      incorrectReasoning:
        "Stress testing is contraindicated in suspected severe symptomatic AS due to risk of hemodynamic collapse. Coronary angiography may be needed pre-operatively but not as the first step. ACE inhibitors are relatively contraindicated in severe AS.",
    },
  },

  // ==========================================================================
  // MODULE: Gastroenterology
  // ==========================================================================

  {
    id: "q33",
    subject: "Gastroenterology",
    vignette:
      "A 55-year-old man with cirrhosis presents with confusion, asterixis, and fetor hepaticus. His lactulose dose was recently reduced. Ammonia level is elevated. Which of the following is the mechanism by which lactulose improves hepatic encephalopathy?",
    options: [
      { id: "A", text: "Acidifies the colon, trapping NH3 as NH4+ and promoting its excretion" },
      { id: "B", text: "Directly metabolizes ammonia in the liver" },
      { id: "C", text: "Reduces gut motility and ammonia production" },
      { id: "D", text: "Chelates ammonia in the bloodstream" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Explain the mechanism of lactulose in hepatic encephalopathy.",
      details:
        "Lactulose is fermented by colonic bacteria to lactic and acetic acids, lowering luminal pH. The acidic environment converts diffusible NH3 (ammonia) to non-diffusible NH4+ (ammonium), which is trapped in the gut and excreted in stool. It also acts as a laxative to accelerate ammonia clearance.",
      incorrectReasoning:
        "Lactulose does not enter the liver or bloodstream to metabolize ammonia directly. It increases gut motility (cathartic effect). It does not chelate systemic ammonia.",
    },
  },

  // ==========================================================================
  // MODULE: Infectious Disease
  // ==========================================================================

  {
    id: "q34",
    subject: "Infectious Disease",
    vignette:
      "A 35-year-old HIV-positive man with a CD4 count of 60 cells/μL presents with headache, fever, and altered mental status. India ink stain of CSF reveals encapsulated yeast organisms. Which of the following is the most appropriate treatment?",
    options: [
      { id: "A", text: "Liposomal amphotericin B + flucytosine induction, then fluconazole" },
      { id: "B", text: "Vancomycin + ceftriaxone" },
      { id: "C", text: "Acyclovir" },
      { id: "D", text: "Fluconazole monotherapy as induction" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Treat cryptococcal meningitis in an immunocompromised patient.",
      details:
        "Cryptococcal meningitis, caused by Cryptococcus neoformans, is diagnosed by India ink stain or cryptococcal antigen in CSF. Treatment follows a three-phase protocol: induction with liposomal amphotericin B + flucytosine (2 weeks), consolidation with fluconazole (8 weeks), then maintenance fluconazole until immune reconstitution.",
      incorrectReasoning:
        "Vancomycin + ceftriaxone covers bacterial meningitis, not fungal. Acyclovir treats viral encephalitis (HSV). Fluconazole monotherapy as induction is inferior and associated with higher mortality.",
    },
  },

  // ==========================================================================
  // MODULE: Endocrinology
  // ==========================================================================

  {
    id: "q35",
    subject: "Endocrinology",
    vignette:
      "A 52-year-old man presents with hypertension resistant to three antihypertensives, muscle weakness, and hypokalemia. His aldosterone-to-renin ratio is markedly elevated. CT abdomen reveals a 1.8 cm left adrenal adenoma. Which of the following is the definitive treatment?",
    options: [
      { id: "A", text: "Laparoscopic adrenalectomy" },
      { id: "B", text: "Spironolactone indefinitely" },
      { id: "C", text: "Fludrocortisone" },
      { id: "D", text: "Bilateral adrenalectomy" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Manage primary hyperaldosteronism due to unilateral adrenal adenoma.",
      details:
        "Conn syndrome (primary hyperaldosteronism) from a unilateral aldosterone-secreting adenoma is cured by laparoscopic adrenalectomy. Adrenal vein sampling confirms lateralization before surgery. Blood pressure and potassium typically normalize post-operatively.",
      incorrectReasoning:
        "Spironolactone (aldosterone antagonist) is used medically for bilateral adrenal hyperplasia or non-surgical candidates but does not cure the underlying adenoma. Fludrocortisone is a mineralocorticoid agonist — the opposite of what is needed. Bilateral adrenalectomy is excessive for a unilateral adenoma.",
    },
  },

  // ==========================================================================
  // MODULE: Nephrology
  // ==========================================================================

  {
    id: "q36",
    subject: "Nephrology",
    vignette:
      "A 24-year-old woman presents with periorbital and peripheral edema, foamy urine, and a serum albumin of 2.0 g/dL. Urinalysis shows 4+ proteinuria but no red cells or casts. Renal biopsy under electron microscopy reveals diffuse podocyte foot process effacement. Which is the most likely diagnosis?",
    options: [
      { id: "A", text: "Minimal change disease" },
      { id: "B", text: "Focal segmental glomerulosclerosis" },
      { id: "C", text: "Membranous nephropathy" },
      { id: "D", text: "IgA nephropathy" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Diagnose minimal change disease in the setting of nephrotic syndrome.",
      details:
        "Minimal change disease is the most common cause of nephrotic syndrome in children and young adults. Electron microscopy shows diffuse foot process effacement with no immune deposits by immunofluorescence. Light microscopy appears normal. It responds dramatically to corticosteroids.",
      incorrectReasoning:
        "FSGS also shows foot process effacement but has segmental scarring on light microscopy. Membranous nephropathy shows subepithelial deposits ('spike and dome'). IgA nephropathy is a nephritic syndrome with hematuria, not primarily nephrotic.",
    },
  },

  // ==========================================================================
  // MODULE: Pulmonology
  // ==========================================================================

  {
    id: "q37",
    subject: "Pulmonology",
    vignette:
      "A 45-year-old nonsmoker woman presents with progressive dyspnea and a dry cough over 18 months. CT chest shows bilateral basal-predominant honeycombing and traction bronchiectasis. PFTs reveal a restrictive pattern with decreased DLCO. Biopsy shows usual interstitial pneumonia (UIP) pattern. Which is the most appropriate management?",
    options: [
      { id: "A", text: "Nintedanib or pirfenidone" },
      { id: "B", text: "High-dose prednisone" },
      { id: "C", text: "Cyclophosphamide" },
      { id: "D", text: "Inhaled bronchodilators" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Treat idiopathic pulmonary fibrosis with antifibrotic therapy.",
      details:
        "The UIP pattern on HRCT and biopsy in a nonsmoker with progressive restrictive disease is diagnostic of idiopathic pulmonary fibrosis (IPF). Nintedanib (tyrosine kinase inhibitor) and pirfenidone (antifibrotic) slow progression and reduce exacerbations. Lung transplant is considered in eligible patients.",
      incorrectReasoning:
        "High-dose prednisone was historically used but is now known to worsen outcomes in IPF (unlike hypersensitivity pneumonitis). Cyclophosphamide is immunosuppressive and harmful in IPF. Bronchodilators address airflow obstruction, not fibrosis.",
    },
  },

  // ==========================================================================
  // MODULE: "Clinical Sciences" — Cardiology, Pulmonology, Nephrology
  // (Multiple disciplines grouped under one module using the `module` field)
  // ==========================================================================

  {
    id: "q38",
    module: "Clinical Sciences",
    subject: "Cardiology",
    vignette:
      "A 60-year-old man presents with sudden-onset severe tearing chest pain radiating to his back. He has a history of poorly controlled hypertension. Blood pressure is 190/110 mmHg in the right arm and 160/95 mmHg in the left arm. Chest X-ray shows mediastinal widening. Which of the following is the most appropriate next step?",
    options: [
      { id: "A", text: "CT angiography of the chest" },
      { id: "B", text: "Thrombolytics" },
      { id: "C", text: "Urgent cardiac catheterization" },
      { id: "D", text: "Echocardiogram only" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Diagnose and evaluate aortic dissection.",
      details:
        "Aortic dissection presents with tearing/ripping pain radiating to the back, blood pressure differential between arms, and mediastinal widening on X-ray. CT angiography is the gold standard for diagnosis and classifying Type A (ascending) vs. Type B (descending) dissection to guide management.",
      incorrectReasoning:
        "Thrombolytics are absolutely contraindicated in dissection as they worsen hemorrhage. Catheterization is for ACS, not dissection. Echo alone misses the full extent of dissection.",
    },
  },

  {
    id: "q39",
    module: "Clinical Sciences",
    subject: "Pulmonology",
    vignette:
      "A 68-year-old man with a 40-pack-year smoking history presents with progressive dyspnea and chronic productive cough for the past 5 years. PFTs show FEV1/FVC ratio of 0.55 and FEV1 of 55% predicted. His symptoms improve slightly with bronchodilators. Which of the following is the most appropriate first-line maintenance therapy?",
    options: [
      { id: "A", text: "Long-acting muscarinic antagonist (LAMA)" },
      { id: "B", text: "Inhaled corticosteroid monotherapy" },
      { id: "C", text: "Short-acting beta-agonist as needed only" },
      { id: "D", text: "Oral theophylline" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Select first-line maintenance therapy for moderate COPD.",
      details:
        "COPD with FEV1/FVC < 0.70 and significant symptoms warrants maintenance bronchodilation. Long-acting muscarinic antagonists (e.g., tiotropium) reduce exacerbations, improve symptoms, and are the preferred first-line maintenance agent for GOLD Group B COPD.",
      incorrectReasoning:
        "Inhaled corticosteroid monotherapy is not recommended for COPD (unlike asthma). SABA alone is for mild intermittent symptoms, not moderate persistent COPD. Oral theophylline has a narrow therapeutic window and significant drug interactions; it is a last-line agent.",
    },
  },

  {
    id: "q40",
    module: "Clinical Sciences",
    subject: "Nephrology",
    vignette:
      "A 70-year-old man with long-standing type 2 diabetes and hypertension is found to have a creatinine of 2.1 mg/dL and urine albumin-to-creatinine ratio of 350 mg/g. BP is 148/90 mmHg. Which drug class provides the most renoprotective benefit in this patient?",
    options: [
      { id: "A", text: "ACE inhibitor or ARB" },
      { id: "B", text: "Calcium channel blocker" },
      { id: "C", text: "Loop diuretic" },
      { id: "D", text: "Beta-blocker" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Identify renoprotective antihypertensives in diabetic nephropathy.",
      details:
        "ACE inhibitors and ARBs reduce intraglomerular pressure by dilating the efferent arteriole, lowering proteinuria and slowing progression of diabetic nephropathy. They are the cornerstone of renoprotection in patients with CKD and proteinuria, regardless of blood pressure control.",
      incorrectReasoning:
        "CCBs are effective antihypertensives but do not independently reduce proteinuria or slow CKD progression. Loop diuretics manage volume but are not renoprotective. Beta-blockers reduce cardiovascular risk but do not slow CKD progression.",
    },
  },

  // ==========================================================================
  // MODULE: "Surgical Specialties" — Orthopedics, OB/GYN, Ophthalmology, ENT
  // ==========================================================================

  {
    id: "q41",
    module: "Surgical Specialties",
    subject: "Ophthalmology",
    vignette:
      "A 65-year-old diabetic man presents with sudden painless loss of vision in his right eye. Fundoscopy reveals a flame-shaped hemorrhage, disc swelling, and dilated tortuous retinal veins in all quadrants. Which of the following is the most likely diagnosis?",
    options: [
      { id: "A", text: "Central retinal vein occlusion" },
      { id: "B", text: "Central retinal artery occlusion" },
      { id: "C", text: "Retinal detachment" },
      { id: "D", text: "Vitreous hemorrhage" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Distinguish central retinal vein from artery occlusion.",
      details:
        "Central retinal vein occlusion (CRVO) presents with sudden painless vision loss and a classic 'blood and thunder' fundus: diffuse flame-shaped hemorrhages in all four quadrants, disc edema, and dilated tortuous veins. Risk factors include hypertension, diabetes, and glaucoma.",
      incorrectReasoning:
        "CRAO presents with sudden painless loss of vision, a pale retina with a cherry-red spot at the macula, and no hemorrhages. Retinal detachment causes a 'curtain' visual field defect. Vitreous hemorrhage shows blood obscuring the fundal view, not the hemorrhage pattern of CRVO.",
    },
  },

  {
    id: "q42",
    module: "Surgical Specialties",
    subject: "ENT",
    vignette:
      "A 45-year-old woman presents with a 3 cm painless neck mass just anterior to the sternocleidomastoid muscle that has been present for 4 weeks. She has no fever, weight loss, or night sweats. Fine-needle aspiration shows squamous epithelium with cholesterol crystals and lymphocytes. Which of the following is the most likely diagnosis?",
    options: [
      { id: "A", text: "Branchial cleft cyst" },
      { id: "B", text: "Thyroglossal duct cyst" },
      { id: "C", text: "Lymphoma" },
      { id: "D", text: "Metastatic squamous cell carcinoma" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Diagnose a branchial cleft cyst.",
      details:
        "Branchial cleft cysts arise from remnants of the second branchial arch and present as lateral neck masses anterior to the SCM, typically in young adults. FNA classically shows squamous cells, cholesterol crystals, and lymphocytes in turbid fluid. Treatment is surgical excision.",
      incorrectReasoning:
        "Thyroglossal duct cysts occur in the midline, elevate with tongue protrusion, and are in the anterior neck near the hyoid. Lymphoma and metastatic SCC both warrant biopsy (and FNA findings differ), but the FNA characteristics here are classic for branchial cleft cyst.",
    },
  },

  {
    id: "q43",
    module: "Surgical Specialties",
    subject: "OB/GYN",
    vignette:
      "A 42-year-old woman presents with heavy menstrual bleeding, pelvic pressure, and urinary frequency. Pelvic exam reveals an enlarged, irregular uterus. Ultrasound shows multiple hypoechoic intramural masses. She desires definitive treatment with no future pregnancies planned. What is the most appropriate management?",
    options: [
      { id: "A", text: "Hysterectomy" },
      { id: "B", text: "Myomectomy" },
      { id: "C", text: "GnRH agonist therapy alone" },
      { id: "D", text: "Endometrial ablation" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Manage symptomatic uterine fibroids in a woman not desiring future fertility.",
      details:
        "Uterine fibroids (leiomyomas) are the most common benign uterine tumors. In a woman with completed childbearing seeking definitive treatment, hysterectomy is curative. Symptoms of heavy bleeding, pressure, and frequency are well addressed.",
      incorrectReasoning:
        "Myomectomy preserves fertility but has higher recurrence rates — appropriate for women desiring future pregnancy. GnRH agonists reduce fibroid size temporarily (used pre-operatively) but symptoms recur when stopped. Endometrial ablation treats bleeding from the lining but does not address the fibroids themselves.",
    },
  },

  {
    id: "q44",
    module: "Surgical Specialties",
    subject: "Orthopedics",
    vignette:
      "A 55-year-old obese woman presents with deep, aching groin pain that worsens with weight-bearing and is relieved by rest. X-ray shows joint space narrowing, subchondral sclerosis, and osteophyte formation in the hip. She has failed conservative measures. Which of the following is the most appropriate definitive treatment?",
    options: [
      { id: "A", text: "Total hip arthroplasty" },
      { id: "B", text: "Intra-articular corticosteroid injection" },
      { id: "C", text: "Core decompression" },
      { id: "D", text: "NSAIDs indefinitely" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Manage end-stage hip osteoarthritis.",
      details:
        "Total hip arthroplasty (THA) is the definitive treatment for end-stage hip osteoarthritis that has failed conservative management. It reliably relieves pain and restores function, with excellent long-term outcomes.",
      incorrectReasoning:
        "Corticosteroid injections provide temporary relief but are not curative. Core decompression is for avascular necrosis, not OA. Long-term NSAIDs carry GI, renal, and cardiovascular risks and are not definitive treatment.",
    },
  },

  // ==========================================================================
  // MODULE: "Neurosciences" — Neurology, Psychiatry, Pharmacology
  // ==========================================================================

  {
    id: "q45",
    module: "Neurosciences",
    subject: "Neurology",
    vignette:
      "A 28-year-old woman presents with episodes of unilateral throbbing headache, nausea, and photophobia lasting 4–72 hours. She has 3–4 episodes per month. Between attacks, she is completely normal. Which of the following is the most appropriate acute treatment for severe attacks?",
    options: [
      { id: "A", text: "Sumatriptan (5-HT1B/1D agonist)" },
      { id: "B", text: "Propranolol" },
      { id: "C", text: "Amitriptyline" },
      { id: "D", text: "Valproate" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Treat acute migraine with appropriate abortive therapy.",
      details:
        "Triptans (e.g., sumatriptan) are first-line abortive agents for moderate-to-severe migraine. They act as serotonin 5-HT1B/1D agonists, causing vasoconstriction of dilated meningeal vessels and inhibiting neuropeptide release. They work best when taken early in the attack.",
      incorrectReasoning:
        "Propranolol, amitriptyline, and valproate are all preventive (prophylactic) agents for migraine, not acute treatments. They reduce attack frequency when taken daily but do not abort an active headache.",
    },
  },

  {
    id: "q46",
    module: "Neurosciences",
    subject: "Psychiatry",
    vignette:
      "A 19-year-old male college student has had two first-break psychotic episodes with auditory hallucinations, delusions, and disorganized speech over the past 8 months. Between episodes he has flat affect, social withdrawal, and poor academic performance. Which diagnosis is most consistent with this presentation?",
    options: [
      { id: "A", text: "Schizophrenia" },
      { id: "B", text: "Brief psychotic disorder" },
      { id: "C", text: "Bipolar I with psychotic features" },
      { id: "D", text: "Major depression with psychotic features" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Diagnose schizophrenia based on DSM-5 criteria.",
      details:
        "Schizophrenia requires ≥6 months of disturbance including ≥1 month of active-phase symptoms (hallucinations, delusions, disorganized speech, negative symptoms). The negative symptoms (flat affect, withdrawal, avolition) between episodes are characteristic of schizophrenia.",
      incorrectReasoning:
        "Brief psychotic disorder lasts < 1 month and has full remission. Bipolar I with psychotic features has prominent mood episodes. Major depression with psychosis has depressed mood as the primary syndrome, not the negative symptom profile described.",
    },
  },

  {
    id: "q47",
    module: "Neurosciences",
    subject: "Pharmacology",
    vignette:
      "A 35-year-old man with HIV on antiretroviral therapy (ART) including ritonavir develops a new fungal infection requiring fluconazole. Ritonavir is a potent CYP3A4 inhibitor. Which of the following best describes the expected pharmacokinetic interaction?",
    options: [
      { id: "A", text: "Increased fluconazole plasma levels due to reduced metabolism" },
      { id: "B", text: "Decreased fluconazole levels due to enzyme induction" },
      { id: "C", text: "No interaction since fluconazole is primarily renally eliminated" },
      { id: "D", text: "Ritonavir is displaced from albumin by fluconazole" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Apply CYP450 inhibition principles to predict drug interactions.",
      details:
        "Ritonavir is a potent CYP3A4 inhibitor (and also inhibits CYP2C9). By inhibiting CYP enzymes responsible for fluconazole metabolism, ritonavir increases fluconazole plasma concentrations. This is actually the basis for 'ritonavir boosting' used intentionally in ART regimens to boost other protease inhibitors.",
      incorrectReasoning:
        "Fluconazole is partially hepatically metabolized and is itself a CYP2C9 inhibitor. Enzyme inducers (e.g., rifampin) would decrease levels, not ritonavir. Protein displacement is not the primary mechanism here.",
    },
  },

  // ==========================================================================
  // MODULE: "Emergency Medicine" — Toxicology, Trauma, Emergency
  // ==========================================================================

  {
    id: "q48",
    module: "Emergency Medicine",
    subject: "Toxicology",
    vignette:
      "A 22-year-old man is brought to the ED after a witnessed seizure at a party. His friends report he had 'multiple pills.' He is confused, tachycardic (HR 135), hyperthermic (39.8°C), diaphoretic, and has clonus. Which of the following is the most likely diagnosis?",
    options: [
      { id: "A", text: "Serotonin syndrome" },
      { id: "B", text: "Neuroleptic malignant syndrome" },
      { id: "C", text: "Anticholinergic toxidrome" },
      { id: "D", text: "Malignant hyperthermia" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Distinguish serotonin syndrome from other hyperthermic syndromes.",
      details:
        "Serotonin syndrome presents with the triad of altered mental status, autonomic instability (tachycardia, hyperthermia, diaphoresis), and neuromuscular abnormalities (clonus, hyperreflexia). It develops rapidly after ingestion of serotonergic agents. Clonus is the key distinguishing feature from other syndromes.",
      incorrectReasoning:
        "NMS is slower in onset (days), caused by antipsychotics, and features 'lead-pipe' rigidity (not clonus) with bradyreflexia. Anticholinergic toxidrome features dry flushed skin, urinary retention, and mydriasis without clonus. Malignant hyperthermia occurs under general anesthesia.",
    },
  },

  {
    id: "q49",
    module: "Emergency Medicine",
    subject: "Trauma",
    vignette:
      "A 30-year-old man is brought in after a high-speed motor vehicle accident. He is in respiratory distress with decreased breath sounds on the left, tracheal deviation to the right, and absent chest wall movement on the left. BP is 80/50 mmHg and HR is 130. Which of the following is the most appropriate immediate intervention?",
    options: [
      { id: "A", text: "Needle decompression of the left chest" },
      { id: "B", text: "Chest X-ray" },
      { id: "C", text: "CT chest" },
      { id: "D", text: "Endotracheal intubation first" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Manage tension pneumothorax as a life-threatening emergency.",
      details:
        "Tension pneumothorax is a clinical diagnosis — do not wait for imaging. It presents with respiratory distress, absent breath sounds, tracheal deviation away from the affected side, and hemodynamic instability. Immediate needle decompression (2nd intercostal space, midclavicular line) is followed by chest tube insertion.",
      incorrectReasoning:
        "Imaging delays a life-saving intervention. With tracheal deviation and hemodynamic collapse, every second counts. Intubation alone does not address the tension pneumothorax and can worsen it by increasing positive pressure.",
    },
  },

  {
    id: "q50",
    module: "Emergency Medicine",
    subject: "Emergency Medicine",
    vignette:
      "A 55-year-old woman collapses in the waiting room. She is unresponsive, pulseless, and apneic. The cardiac monitor shows ventricular fibrillation. Which of the following is the most important immediate intervention?",
    options: [
      { id: "A", text: "Defibrillation" },
      { id: "B", text: "Epinephrine 1 mg IV" },
      { id: "C", text: "Amiodarone 300 mg IV" },
      { id: "D", text: "Endotracheal intubation" },
    ],
    correctAnswer: "A",
    explanation: {
      objective: "Prioritize defibrillation in shockable cardiac arrest rhythms.",
      details:
        "Ventricular fibrillation is a shockable rhythm. Defibrillation is the single most effective intervention for VF and must be performed as soon as possible — survival decreases by ~10% per minute without defibrillation. High-quality CPR continues immediately after shock delivery.",
      incorrectReasoning:
        "Epinephrine is given every 3–5 minutes during CPR but after the first shock. Amiodarone is used for shock-refractory VF (after 2+ shocks). Intubation is a secondary priority — oxygenation via bag-mask is adequate initially.",
    },
  },

  // ==========================================================================
  // ↓↓ ADD YOUR NEW QUESTIONS BELOW THIS LINE ↓↓
  // Copy the template from the top of this file, paste here, and fill it in.
  // To add a NEW MODULE, just use a new subject string — no other changes needed.
  // To GROUP DISCIPLINES: add `module: "Module Name"` to questions in the same group.
  // ==========================================================================

]

// ============================================================================
// LAB VALUES — Normal reference ranges shown in the Lab Values modal.
//
// HOW TO EDIT:
//   • Add a new category  → add a new object to the array below.
//   • Add a value         → add to the `values` array inside a category.
//   • Remove a value      → delete the line.
//   • The modal renders all categories and values automatically.
// ============================================================================

export const labValues: LabCategory[] = [
  {
    category: "Chemistry",
    values: [
      { name: "Sodium (Na+)",         range: "136 – 145", units: "mEq/L"  },
      { name: "Potassium (K+)",        range: "3.5 – 5.0", units: "mEq/L"  },
      { name: "Chloride (Cl-)",        range: "98 – 106",  units: "mEq/L"  },
      { name: "Bicarbonate (HCO3-)",   range: "22 – 28",   units: "mEq/L"  },
      { name: "Blood Urea Nitrogen",   range: "7 – 18",    units: "mg/dL"  },
      { name: "Creatinine",            range: "0.6 – 1.2", units: "mg/dL"  },
      { name: "Glucose (fasting)",     range: "70 – 100",  units: "mg/dL"  },
      { name: "Calcium (total)",       range: "8.4 – 10.2",units: "mg/dL"  },
      { name: "Magnesium",             range: "1.5 – 2.0", units: "mEq/L"  },
    ],
  },
  {
    category: "Hematology",
    values: [
      { name: "Hemoglobin (male)",     range: "13.5 – 17.5", units: "g/dL" },
      { name: "Hemoglobin (female)",   range: "12.0 – 16.0", units: "g/dL" },
      { name: "Hematocrit (male)",     range: "41 – 53",      units: "%"   },
      { name: "Hematocrit (female)",   range: "36 – 46",      units: "%"   },
      { name: "Leukocyte count (WBC)", range: "4,500 – 11,000",units: "/mm³"},
      { name: "Platelet count",        range: "150,000 – 400,000",units: "/mm³"},
      { name: "Mean corpuscular volume",range: "80 – 100",    units: "fL"  },
      { name: "INR (no anticoagulation)",range: "0.8 – 1.1",  units: ""   },
    ],
  },
  {
    category: "Lipids",
    values: [
      { name: "Total cholesterol",  range: "< 200", units: "mg/dL" },
      { name: "LDL cholesterol",    range: "< 100", units: "mg/dL" },
      { name: "HDL cholesterol",    range: "> 40",  units: "mg/dL" },
      { name: "Triglycerides",      range: "< 150", units: "mg/dL" },
    ],
  },
]
