Product Requirements Document (PRD): (Phase 1)
1. Product Overview & Vision
Product Name: (TopRankMed) / toprankmed.com / step 1 bank/ step 2 bank / etc., 
Phase: 1 (Core Exam Prep & Competitive Learning)
Vision: To build the most engaging, high-yield AI study companion for medical board exams. By combining adaptive AI tutoring with gamified peer-to-peer competition, the platform transforms the typically isolating and grueling USMLE prep journey into a dynamic, community-driven experience.
Problem Statement: Current medical question banks are static, isolating, and fail to adapt to a student's real-time cognitive blind spots. Furthermore, exam preparation for IMGs often lacks a sense of community pacing, leading to burnout and suboptimal study strategies.
Solution: A dual-engine platform featuring an Agentic AI Tutor that dynamically generates high-yield content based on individual weaknesses, paired with "The Arena" - a competitive benchmarking ecosystem that leverages social motivation to drive study consistency.
2. Target Personas
Primary User: US MD, US DO, International Medical Graduates (IMGs) preparing for USMLE Step 1, Step 2 CK, or Step 3. (Pawan team to help with reaching out to societies/med schools)
Psychographics: Highly driven but anxious about performing against US medical graduates. They value high-yield study efficiency and crave realistic benchmarking against their peers.
User Goals: Maximize USMLE scores, reduce study fatigue through engaging formats, and accurately predict their board exam readiness.

3. Core Features & Requirements (Phase 1) / Avoid terminology AI on the face-value 
Feature 1: The Infinite AI Q-Bank
Description: A proprietary, dynamically generated bank of USMLE-style questions. Instead of paying for static banks that get outdated, the system generates novel clinical vignettes on demand, targeting the student's specific weak areas.
Key Capabilities:
RAG-Driven Vignette Generation: Uses a robust Retrieval-Augmented Generation stack grounded strictly in current, validated medical literature to dynamically create patient scenarios, lab results, and multiple-choice options.
Human-in-the-loop (HITL) Quality Control: An internal evaluation framework where subject matter experts randomly audit generated questions, using relevance scoring and hallucination guardrails to continuously refine model reliability and ensure absolute medical accuracy.
Adaptive Question Serving: Employs item response theory; if a student struggles with renal physiology, the system seamlessly dials up the frequency and complexity of renal questions in their daily mix.
Content Team - BackEnd Engg team collaboration on the qbank process.
Process of collaboration - “”
Feature 2: Full-Length AI Mock Exams
Description: Realistic, timed simulations of the actual USMLE Step 1 and Step 2 CK testing environments to build endurance and gauge true exam readiness.
Key Capabilities:
Block-by-Block Simulation: Replicates the exact UI, timing, and break structures of the real USMLE software (e.g., 20-question blocks, 4/8-hour total test time).
Predictive Scoring Algorithm: Analyzes performance across the mock exam to forecast the user's actual 3-digit score with high accuracy. (- tough to predict scores - Amboss has been trying for long) (a bit easy on the prediction element - not a main feature as much for GTM)
Post-Mock AI Debrief: Instead of just showing correct/incorrect, the AI agent breaks down the exam block by block, highlighting cognitive fatigue patterns (e.g., "Your accuracy dropped by 30% in block 6") and pinpointing systemic knowledge gaps. (for later too)
Feature 3: "The Arena" (Study Competition & Social Learning) - (nice to have, not a must initially)
Description: A gamified, peer-to-peer competitive environment designed to harness the natural competitiveness of medical students to increase daily active engagement.
Key Capabilities:
Live Clinical Battles: Synchronous, 5-minute timed quizzes where users can challenge friends or random peers in specific organ systems (e.g., "Cardiology Blitz").
Global & Cohort Leaderboards: Rankings based on questions answered correctly, streak maintenance, and battle win rates. Users can filter by target specialty or geographic region.
Guilds / Study Squads: Users can form small groups to pool points, unlock advanced AI study resources, and compete in weekly squad challenges.
Reward for good engagement: Candidates with certain streaks get discount on the pricing of the App(Top 10% or so performers at all times). We can define more rules on this.
A "Battle" (specifically a Live Clinical Battle) is the core gamified feature within "The Arena" designed to make studying interactive and competitive.
Here is exactly how a Battle works within the app:
Real-Time Head-to-Head: It is a live, synchronous quiz where two students compete against each other at the exact same time.
Time-Boxed: It is short and intense—typically a 5-minute rapid-fire session.
Targeted Topics: Users can challenge each other on specific organ systems or medical disciplines (for example, a "Cardiology Blitz" or a "Pharmacology Face-off").
Social Connectivity: A user can send a direct challenge to a friend (or a member of their study "Guild") or opt to be matched with a random peer who is currently online.
The Product Strategy Behind It
Studying for the USMLE is notoriously isolating and grueling. The "Battle" mechanic leverages social motivation and friendly competition to break up the monotony of solo studying. By turning static question banks into a dynamic game, it drives higher daily app engagement, prevents cognitive fatigue, and gives students a realistic benchmark of how they stack up against their peers in real-time.

Feature 4: Exam Readiness Dashboard
Description: A highly visual analytics center replacing the traditional "percent correct" metric with an AI-calculated exam readiness score.
Key Capabilities:
Target Score Forecasting: Uses predictive modeling to estimate the user's actual USMLE 3-digit score based on current trajectory and peer benchmarking. Step 1 - Pass/Fail, Step 2 - (more difficult - so backseated)
Burnout Barometer: Analyzes interaction latency and error rates over time to suggest mandatory breaks(think..), preventing cognitive fatigue.
Knowledge Heatmap: A visual representation of the human body and organ systems, color-coded by the user's demonstrated proficiency.
4. Technical Architecture
To support rapid iteration, AI heavy-lifting, and real-time competitive features, the architecture must be highly scalable and responsive.
Frontend: React / React Native for a seamless, cross-platform experience (web and mobile app).
Backend & AI Logic: Python-based microservices managing the LLM orchestration and data processing.
Infrastructure: Google Cloud Platform (GCP) or Firebase to handle real-time database syncing required for "The Arena" (live battles and leaderboards).
AI Stack: * A robust Retrieval-Augmented Generation (RAG) pipeline to ensure all AI responses are strictly grounded in validated medical literature, eliminating hallucinations.
Low-latency LLM API integration for the conversational Socratic tutor.
5. Go-To-Market & Distribution Strategy
Initial Launch: Leverage established IMG networks and communities (such as USMLESarthi and Yousef’s online base of students) to beta test the platform. Rolling out to an existing, highly motivated user base minimises our initial Customer Acquisition Cost (CAC) and immediately populates the leaderboards to make the competitive features viable. 
Viral Loops: Implement referral mechanics tied to "The Arena." (e.g., "Invite a study partner to unlock a 50-question mock exam").
Referral based points for discount on invitation. (Free Trial Period for certain-time OR a free version of the app - temporary basis - less costly)
6. Future Roadmap (Phase 2)
MatchGPS Integration: Once the user completes their exams, the platform will utilize their finalized scores and data profile to unlock the residency program recommendation engine.
Application Strategy: AI-driven curation of reach, target, and safety residency programs based on the Phase 1 performance data.

7. Success Metrics (KPIs)
Engagement: 
Daily Active Users (DAU) to Monthly Active Users (MAU) ratio.
Average number of "Battles" initiated per user per week.
Effectiveness: 
Accuracy of the Target Score Forecast compared to self-reported actual USMLE scores.
Technical Reliability: * Sub-second latency on Live Clinical Battles.
Zero critical hallucination reports in the AI Tutor explanations.
