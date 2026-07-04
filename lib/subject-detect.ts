/**
 * Lightweight keyword-based clinical discipline detector.
 *
 * Used as a heuristic fallback wherever an LLM (Gemini) is unavailable or
 * fails — the various regex-based parsers have no way to intelligently read
 * a vignette, so without this every imported question would be dumped under
 * a single subject (the module/file name), defeating discipline sorting.
 *
 * This is intentionally simple: score each discipline by keyword hits in the
 * text and return the top scorer. Not as accurate as an LLM, but far better
 * than a single blanket label for the whole import.
 */

const DISCIPLINE_KEYWORDS: Record<string, string[]> = {
  Cardiology: [
    "heart", "cardiac", "myocardial", "coronary", "arrhythmia", "murmur",
    "ecg", "ekg", "chest pain", "hypertension", "atrial", "ventricular",
    "valve", "angina", "infarction", "cardiomyopathy", "pericard", "aorta",
    "aortic", "systolic", "diastolic", "tachycardia", "bradycardia",
  ],
  Pulmonology: [
    "lung", "respiratory", "asthma", "copd", "pneumonia", "dyspnea",
    "bronch", "pleural", "pulmonary embolism", "spirometry", "hypoxia",
    "wheeze", "sputum", "tuberculosis", "pneumothorax",
  ],
  Nephrology: [
    "kidney", "renal", "dialysis", "creatinine", "nephro", "glomerul",
    "urea", "proteinuria", "hematuria", "electrolyte", "acid-base",
    "acute kidney injury", "chronic kidney disease",
  ],
  Gastroenterology: [
    "liver", "hepatic", "stomach", "intestin", "bowel", "gi bleed",
    "pancrea", "cirrhosis", "colon", "esophag", "gastric", "diarrhea",
    "constipation", "jaundice", "hepatitis", "peptic ulcer",
  ],
  Endocrinology: [
    "diabetes", "thyroid", "insulin", "glucose", "hormone", "adrenal",
    "pituitary", "cortisol", "hba1c", "hypoglycemia", "hyperglycemia",
    "goiter", "parathyroid", "metabolic syndrome",
  ],
  Neurology: [
    "brain", "seizure", "stroke", "neuro", "cranial", "spinal cord",
    "parkinson", "alzheimer", "migraine", "epilepsy", "meningitis",
    "encephalitis", "cerebral", "peripheral neuropathy", "paralysis",
  ],
  "Infectious Disease": [
    "infection", "bacteria", "virus", "sepsis", "antibiotic", "hiv",
    "tuberculosis", "fever of unknown origin", "malaria", "pathogen",
    "antimicrobial", "abscess", "cellulitis",
  ],
  "Obstetrics & Gynecology": [
    "pregnan", "uterus", "ovary", "ovarian", "cervix", "cervical",
    "menstru", "obstetric", "gynec", "fetal", "fetus", "placenta",
    "labor", "postpartum", "menopause", "endometri",
  ],
  Pediatrics: [
    "infant", "newborn", "neonat", "pediatric", "toddler", "child",
    "adolescent", "growth chart", "immunization schedule",
  ],
  Psychiatry: [
    "depression", "anxiety", "psychosis", "schizophrenia", "bipolar",
    "mental status", "suicid", "hallucination", "delusion", "mood disorder",
    "personality disorder", "substance use disorder",
  ],
  Hematology: [
    "anemia", "hemoglobin", "leukemia", "lymphoma", "platelet",
    "coagulation", "bleeding disorder", "thrombocytopenia", "sickle cell",
    "bone marrow",
  ],
  Rheumatology: [
    "arthritis", "joint pain", "lupus", "rheumat", "autoimmune",
    "vasculitis", "gout", "ankylosing spondylitis", "sjogren",
  ],
  Dermatology: [
    "skin", "rash", "dermat", "lesion", "eczema", "psoriasis", "melanoma",
    "urticaria", "acne",
  ],
  "General Surgery": [
    "surgical", "incision", "appendectomy", "laparotomy", "postoperative",
    "surgery", "hernia", "cholecystitis",
  ],
  Pharmacology: [
    "mechanism of action", "drug interaction", "pharmacokinetic",
    "pharmacodynamic", "adverse effect", "contraindication", "dosage",
    "half-life", "receptor agonist", "receptor antagonist",
  ],
  Ophthalmology: [
    "eye", "vision", "retina", "cornea", "glaucoma", "cataract", "pupil",
  ],
  "Otolaryngology (ENT)": [
    "ear", "nose", "throat", "sinus", "hearing loss", "tinnitus", "tonsil",
  ],
  Orthopedics: [
    "fracture", "bone", "joint replacement", "ligament", "tendon",
    "orthopedic", "osteoarthritis", "osteoporosis",
  ],
  Urology: [
    "prostate", "bladder", "urinary tract", "urolog", "erectile",
    "testicular",
  ],
}

const COMPILED = Object.entries(DISCIPLINE_KEYWORDS).map(([discipline, words]) => ({
  discipline,
  regex: new RegExp(`\\b(?:${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi"),
}))

/**
 * Score `text` against each known discipline's keyword list and return the
 * best match. Falls back to `fallback` (e.g. the module/file name) if no
 * discipline scores above the minimum threshold.
 */
export function detectSubject(text: string, fallback: string): string {
  if (!text || !text.trim()) return fallback

  let best: { discipline: string; score: number } | null = null
  for (const { discipline, regex } of COMPILED) {
    regex.lastIndex = 0
    const matches = text.match(regex)
    const score = matches ? matches.length : 0
    if (score > 0 && (!best || score > best.score)) {
      best = { discipline, score }
    }
  }

  return best ? best.discipline : fallback
}
