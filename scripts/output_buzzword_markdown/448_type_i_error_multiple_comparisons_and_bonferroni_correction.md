# Type I Error — Multiple Comparisons and Bonferroni Correction

## Metadata

| Field | Value |
|-------|-------|
| System | Biostatistics & Epidemiology/Population Health |
| Discipline | Behavioral Sciences |
| Difficulty | 3 (Medium) |
| Cognitive Level | Application |
| Trap Type | Buzzword Trap |
| Question Type | Buzzword |

## Buzzword Question

A clinical trial tests a new drug across 20 different outcome measures simultaneously, all with alpha = 0.05. Three outcomes reach p < 0.05. A statistician warns that these findings may be spurious. Which of the following best explains the statistician's concern?

## Buzzwords Used

20 outcomes tested; alpha = 0.05; 3 outcomes p < 0.05; simultaneous testing; spurious findings

## Answer Options

A) Testing 20 hypotheses simultaneously at alpha = 0.05 yields an expected 1 false positive by chance alone; Bonferroni correction would set alpha to 0.0025 per test
 B) The p-values are all below 0.05, which means all three results are definitely true positives C) Testing multiple outcomes increases statistical power and reduces the chance of Type II error 
D) A p-value below 0.05 always rules out the possibility of a false positive finding

## Correct Answer

A

## Explanation

When multiple hypotheses are tested simultaneously, the familywise error rate (probability of at least one false positive) rises dramatically. With 20 tests at alpha = 0.05, the expected number of false positives = 20 × 0.05 = 1 by chance alone. The Bonferroni correction addresses this by dividing alpha by the number of comparisons: corrected alpha = 0.05/20 = 0.0025. Only p-values below 0.0025 would be considered statistically significant after correction. Finding 3 positives out of 20 tests is consistent with chance variation and does not necessarily reflect true drug efficacy.

## Buzzword Combination (Correct)

Multiple simultaneous tests → inflated Type I error; Bonferroni correction = alpha/number of tests; expected false positives = n × alpha

## Wrong Options

### B) The p-values are all below 0.05, which means all three results are definitely true positives

A p-value below 0.05 means there is less than a 5% probability of observing this result if the null hypothesis were true  it does NOT guarantee a true positive. With 20 simultaneous tests, 1 false positive is expected by chance. Without correction for multiple comparisons, p < 0.05 does not establish that a finding is a true positive

**Buzzword Combo:** p < 0.05 = statistically significant under H₀ but does NOT exclude false positive; multiple testing inflates Type I error

### C) Testing multiple outcomes increases statistical power and reduces the chance of Type II error


Testing multiple outcomes does NOT increase power. Power refers to the ability to detect a true effect for a single hypothesis and depends on sample size, effect size, and alpha. Multiple testing INCREASES Type I error (false positives), not power. The statistician is concerned about false positives, not Type II errors.


**Buzzword Combo:** Power = 1 - beta = ability to detect true effect; multiple comparisons inflate alpha (Type I), not power

### D) A p-value below 0.05 always rules out the possibility of a false positive finding


A p-value below 0.05 sets alpha  the pre-specified acceptable false positive rate at 5%. It means a 5% (or lower) probability of a false positive under the null hypothesis, not zero probability. With 20 tests, approximately 1 result is expected to reach p < 0.05 purely by chance.

**Buzzword Combo:** Alpha = pre-specified acceptable Type I error rate (5%); p < alpha = statistically significant but ~5% expected to be false positives

## Related Concepts

Type II error; Power; p-value interpretation; False discovery rate

## Tags

Type I error; Multiple comparisons; Bonferroni correction; Familywise error rate; Alpha; p-value; False positive

---

*Imported from Excel row 449*

<!-- METADATA: Source=Excel, Row=449, Topic=Type I Error — Multiple Comparisons and Bonferroni Correction, Type=Buzzword -->