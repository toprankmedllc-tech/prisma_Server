# Latent Error / Swiss Cheese Model

## Metadata

| Field | Value |
|-------|-------|
| QID | N/A |
| System | Social Sciences: Communication and Interpersonal Skills |
| Discipline | Behavioral Sciences |
| Difficulty | 3 (Medium) |
| Cognitive Level | Clinical Reasoning |
| Trap Type | Similar Diagnosis Confusion |

## Vignette

 A 68-year-old man with heart failure, CKD stage 3, and type 2 diabetes is admitted to the medical ICU for respiratory failure and started on IV heparin for pulmonary embolism. On hospital day 3, a fatigued overnight intern, at the end of a 26-hour shift, writes a heparin infusion order with a rate calculation error that effectively prescribes 10 times the intended dose. The order is entered into the EHR at 2:14 AM.  The overnight pharmacist, simultaneously covering three ICUs with 11 pending medication verifications, reviews the order without noticing the tenfold rate discrepancy and approves it within 4 minutes. The night-shift nurse, 11 hours into her shift and managing five ventilated patients simultaneously, administers the medication at 2:31 AM without performing the required two-nurse weight-based dose verification. Seventeen minutes after infusion begins, the patient develops signs of catastrophic intracranial hemorrhage and does not survive.  Root cause analysis identifies multiple contributing factors: physician fatigue from a 26-hour shift, inadequate pharmacy staffing ratios, nursing failure to perform the two-nurse verification protocol, and  most critically the hospital's EHR clinical decision support system had been configured 14 months earlier by a hospital IT committee to suppress all heparin dosing alerts in the ICU following multiple complaints from staff about excessive alert fatigue. This suppression had never been audited or re-evaluated.  Using the Swiss cheese model of medical error, the suppressed EHR heparin dosing alert is best classified as which type of error, and why?

## Key Symptoms

Intern active error (fatigue-induced wrong order); pharmacist active error (overload-driven approval failure); nurse active error (skipped two-nurse check); EHR alert suppressed 14 months prior by administrative decision = latent condition; Swiss cheese: holes align → catastrophic harm

## Labs

NA

## Main Clue

EHR heparin alert suppressed 14 months prior by administrative/IT committee decision, dormant system-level vulnerability present long before the incident, invisible at point of care, would have caught error if active = latent condition (blunt end) in Swiss cheese model

## Supporting Clue

Active errors = immediate human mistakes at point of care (sharp end): intern, pharmacist, nurse. Latent conditions = organizational/system failures (blunt end): suppressed alert, inadequate staffing ratios. Death = sentinel event (outcome category, not error type).

## Question

Using the Swiss cheese model, the suppressed EHR heparin dosing alert is best classified as which type of error?

## Correct Answer

A

## Wrong Options

### 1 (B): An active error — a direct human mistake at point of care

*No explanation provided in source data*

### 2 (C): A near-miss event — safety failure identified before reaching the patient

*No explanation provided in source data*

### 3 (D): A sentinel event — an unexpected death requiring root cause analysis

*No explanation provided in source data*

### 4 (E): A forcing function — a system design feature that prevents errors

*No explanation provided in source data*

---

*Imported from Excel row 237*

<!-- METADATA: Source=Excel, Row=237, Topic=Latent Error / Swiss Cheese Model, QID= -->