# Negative Predictive Value Formula

## Metadata

| Field | Value |
|-------|-------|
| System | Biostatistics & Epidemiology/Population Health |
| Discipline | Behavioral Sciences |
| Difficulty | 2 |
| Cognitive Level | Recall |
| Trap Type | Buzzword Trap |
| Question Type | Buzzword |

## Buzzword Question

In the same colorectal cancer screening study (500 patients; 50 with confirmed cancer; 45 true positives, 5 false negatives; 450 without cancer; 27 false positives, 423 true negatives), the negative predictive value (NPV) of the FIT test is:

## Buzzwords Used

50 disease-positive; 5 false negatives; 45 true positives; 450 disease-negative; 423 true negatives; 27 false positives; negative test result

## Answer Options

A) 99% 
B) 94% 
C) 90% 
D) 63%

## Correct Answer

A

## Explanation

NPV = TN/(TN+FN) = 423/(423+5) = 423/428 = 0.9883 ≈ 99%. NPV measures the probability that a patient with a negative test result truly does not have the disease. It reads across the test-negative row of the 2×2 table (TN in denominator, not FP). A NPV of 99% means that 99% of patients with a negative FIT result truly do not have colorectal cancer — making a negative result very reassuring in this population.

## Buzzword Combination (Correct)

TN/(TN+FN) × 100 = NPV = probability of true negative given a negative test result

## Wrong Options

### B) 94%

94% is the specificity of this test = TN/(TN+FP) = 423/450. Specificity reads down the disease-negative column; NPV reads across the test-negative row. The key distinction: specificity denominator = all disease-negative patients (TN+FP = 450); NPV denominator = all test-negative patients (TN+FN = 428).

**Buzzword Combo:** TN/(TN+FP) = Specificity (disease-negative column) — not NPV; NPV uses test-negative row = TN/(TN+FN)

### C) 90%

90% is the sensitivity of this test = TP/(TP+FN) = 45/50. This is an entirely different metric reading down the disease-positive column. NPV = TN/(TN+FN) = 423/428 ≈ 99%.

**Buzzword Combo:** TP/(TP+FN) = Sensitivity — not NPV; use test-negative row TN/(TN+FN) for NPV

### D) 63%

63% approximates the PPV = TP/(TP+FP) = 45/72 ≈ 62.5%, which reads across the test-positive row. NPV reads across the test-negative row. Confusing PPV and NPV rows is a common 2×2 table error.


**Buzzword Combo:** TP/(TP+FP) = PPV (test-positive row) — not NPV; NPV = TN/(TN+FN) on test-negative row


## Related Concepts

PPV; Sensitivity; Specificity; Prevalence effect on NPV; Likelihood ratio

## Tags

NPV; Negative predictive value; TN; FN; 2x2 table; Colorectal cancer; FIT; Test performance

---

*Imported from Excel row 427*

<!-- METADATA: Source=Excel, Row=427, Topic=Negative Predictive Value Formula, Type=Buzzword -->