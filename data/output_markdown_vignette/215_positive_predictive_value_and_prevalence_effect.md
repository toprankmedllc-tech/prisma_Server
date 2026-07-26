# Positive Predictive Value and Prevalence Effect

## Metadata

| Field | Value |
|-------|-------|
| QID | N/A |
| System | Biostatistics & Epidemiology/Population Health |
| Discipline | Behavioral Sciences |
| Difficulty | 4 |
| Cognitive Level | Clinical Reasoning |
| Trap Type | Buzzword Trap |

## Vignette

A pharmaceutical company has developed a novel blood-based biomarker test for early detection of pancreatic adenocarcinoma. Validation studies demonstrate that the test has a sensitivity of 90% and a specificity of 95% across multiple cohorts. The company is now in discussions with hospital administrators about deploying the test in two different clinical settings.  The first proposed deployment is in a large community-based primary care screening program in which the background prevalence of undiagnosed pancreatic cancer is estimated at 0.1% based on national registry data for the age group being screened. The second proposed deployment is in a high-risk surveillance clinic serving patients with hereditary pancreatitis, familial pancreatic cancer syndromes, or new-onset diabetes mellitus in patients over 50 years of age — where the estimated disease prevalence is approximately 10%.  The medical director wants to understand the implications of these two deployment contexts before making a purchasing decision.  Compared to its performance in the community screening program (Setting 1), how does the positive predictive value (PPV) of this test compare when used in the high-risk surveillance clinic (Setting 2)?

## Key Symptoms

Fixed sensitivity 90%; fixed specificity 95%; Setting 1 prevalence 0.1% → PPV ≈ 1.8%; Setting 2 prevalence 10% → PPV ≈ 67%; PPV dramatically higher in high-prevalence setting


## Labs

Setting 1 (10,000 population): Disease+=10; TP=9; Disease-=9,990; FP=499.5; PPV=9/508.5≈1.8% Setting 2 (10,000 population): Disease+=1,000; TP=900; Disease-=9,000; FP=450; PPV=900/1350≈67%

## Main Clue

PPV = TP/(TP+FP) and is STRONGLY influenced by disease prevalence — low prevalence generates many false positives relative to true positives, dramatically lowering PPV even with high specificity

## Supporting Clue

Sensitivity and specificity are fixed test properties; PPV and NPV are population-dependent; in low-prevalence screening, even highly specific tests generate more false positives than true positives

## Question

Compared to its performance in the community screening program (Setting 1), how does the positive predictive value (PPV) of this test compare when used in the high-risk surveillance clinic (Setting 2)?

## Correct Answer

A

## Wrong Options

### 1 (B): PPV is identical in both settings because sensitivity and specificity are fixed properties of the test

*No explanation provided in source data*

### 2 (C): PPV is lower in Setting 2 because higher disease burden increases the total number of patients tested

*No explanation provided in source data*

### 3 (D): PPV is identical because PPV depends only on specificity and is not affected by prevalence

*No explanation provided in source data*

### 4 (E): PPV is slightly higher in Setting 2 but sensitivity and specificity must be recalculated for the new population

*No explanation provided in source data*

---

*Imported from Excel row 216*

<!-- METADATA: Source=Excel, Row=216, Topic=Positive Predictive Value and Prevalence Effect, QID= -->