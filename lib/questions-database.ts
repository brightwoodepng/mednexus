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
  // ↓↓ ADD YOUR NEW QUESTIONS BELOW THIS LINE ↓↓
  // Copy the template from the top of this file, paste here, and fill it in.
  // To add a NEW MODULE, just use a new subject string — no other changes needed.
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
