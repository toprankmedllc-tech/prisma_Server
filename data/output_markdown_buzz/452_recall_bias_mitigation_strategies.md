# Recall Bias — Mitigation Strategies

## Metadata

| Field | Value |
|-------|-------|
| System | Biostatistics & Epidemiology/Population Health |
| Discipline | Behavioral Sciences |
| Difficulty | 3 (Medium) |
| Cognitive Level | Application |
| Trap Type | Similar Diagnosis Confusion |
| Question Type | Buzzword |

## Buzzword Question

A case-control study examines whether first-trimester acetaminophen use is associated with childhood autism. Mothers of children with autism are more likely than control mothers to recall and report minor medication use during pregnancy. Which of the following study design modifications would BEST reduce this source of systematic error?

## Buzzwords Used

Case-control; autism cases vs controls; retrospective recall; medication use; mothers recall differently

## Answer Options

A) Replace maternal recall with prospective pharmacy dispensing records or medical chart review for medication exposure 
B) Increase the sample size to reduce the influence of recall differences
 C) Use a randomized controlled trial design instead of case-control 
D) Adjust for recall bias using multivariate logistic regression

## Correct Answer

A

## Explanation

Recall bias occurs in retrospective studies when cases (who have a known adverse outcome) remember past exposures differently often more thoroughly  than controls. The most effective mitigation is to replace subjective recall with objective records: pharmacy dispensing data, electronic health record medication lists, or prospective data collected before outcome status is known. These approaches eliminate differential recall because the exposure data is recorded independently of case/control status. This is why prospective cohort designs are less susceptible to recall bias - exposure is measured before the outcome occurs.

## Buzzword Combination (Correct)

Recall bias in case-control = cases recall exposure more than controls; mitigation = objective records (pharmacy/EHR) instead of self-report

## Wrong Options

### B) Increase the sample size to reduce the influence of recall differences

Increasing sample size reduces random error (increases precision) but does NOT reduce systematic error (bias). Recall bias is a systematic, directional error, it consistently distorts the exposure-outcome association in the same direction regardless of sample size. Larger studies simply produce more precise estimates of a biased association.

**Buzzword Combo:** ↑ sample size → ↓ random error (↑ precision); does NOT fix systematic bias; recall bias = systematic, not random

### C) Use a randomized controlled trial design instead of case-control

While RCTs are less susceptible to recall bias (exposure is assigned prospectively), they are ethically and practically impossible for studying a potential teratogen. You cannot randomize pregnant women to take a medication suspected of harming children. The question asks about modifying the existing observational study design.

**Buzzword Combo:** RCT = prospective exposure assignment → eliminates recall bias; but RCT unethical for teratogens in pregnancy

### D) Adjust for recall bias using multivariate logistic regression

Multivariate regression adjusts for measured confounders, not for bias in the exposure measurement itself. Recall bias is a measurement error problem, the exposure variable (medication use) is itself incorrectly measured differentially by case status. Regression analysis cannot correct for differential misclassification of the exposure.


**Buzzword Combo:**  Regression adjusts for confounding (measured variables), NOT for differential misclassification or recall bias in the exposure

## Related Concepts

Selection bias; Information bias; Confounding; Prospective cohort study

## Tags

Recall bias; Case-control; Systematic error; Retrospective study; Mitigation; Pharmacy records; Bias types

---

*Imported from Excel row 453*

<!-- METADATA: Source=Excel, Row=453, Topic=Recall Bias — Mitigation Strategies, Type=Buzzword -->