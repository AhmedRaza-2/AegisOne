# URL evaluation - v10_rules2

- legit_popular (n=498): false alarms WARN(>=35) 2.41%, BLOCK(>=60) 2.41%
- legit_web (n=2000): false alarms WARN(>=35) 0.80%, BLOCK(>=60) 0.45%
- openphish_fresh (n=300): recall WARN 94.0%, BLOCK 89.3%
  - final: AUC 0.991 | TPR@FPR 1% 91.3%, 0.1% 31.7% | AP@1% base rate 0.589
  - neural: AUC 0.839 | TPR@FPR 1% 62.0%, 0.1% 28.7% | AP@1% base rate 0.511
- mut_subdomain_injection (n=300): recall WARN 100.0%, BLOCK 100.0%
  - final: AUC 1.000 | TPR@FPR 1% 100.0%, 0.1% 100.0% | AP@1% base rate 1.000
  - neural: AUC 0.000 | TPR@FPR 1% 0.0%, 0.1% 0.0% | AP@1% base rate 0.005
- mut_path_padding (n=300): recall WARN 89.7%, BLOCK 85.3%
  - final: AUC 0.989 | TPR@FPR 1% 87.0%, 0.1% 31.3% | AP@1% base rate 0.568
  - neural: AUC 0.838 | TPR@FPR 1% 59.7%, 0.1% 30.3% | AP@1% base rate 0.501

Worst false positives (legit_popular):
- 0.60  https://bit.ly/0176044968?fbclid=IwZXh0bgNhZW0CMTAAAR3XT5YfiZ_YrVkuPmChl0sQLDKKvdkWCHEDZAw2JAgfkBff8IF853CiOAw_aem_ZmFrZWR1bW15MTZieXRlcw
- 0.60  https://bunkr.pk/a/0kSbybQK
- 0.60  https://dns.google/?af=RQ4SG2
- 0.60  https://expireddomains.com/?saved=moz_gd
- 0.60  https://bit.ly/0176044968?fbclid=IwAR1i4yRTeTSFvo1emwqx9XvzMcPSjKgDFsxraGsefOB1rsfdFUnVyOQ4plU
- 0.60  https://bit.ly/0176044968?fbclid=IwZXh0bgNhZW0CMTAAAR3cpUk_X4PX_8Hv2XblXmToWTAqWksOnAuPYpjEHb-g8ly7NmlYLib2cW4_aem_AZNNX-5sOL7T6gdZqY5q-b3yT
- 0.60  https://dns.google/?7ee519f739c5414e8c1f-bd40d205906a9c02051d-8b8c42699fc4595ff0f5cfc06e069d80-57fe469ca9c6c73a4664e482-fc709a099ad14ce7-8fd
- 0.60  https://bunkr.pk/a/08YYMIBZ

Worst false positives (legit_web):
- 0.82  http://cod4-server.info/?page=profile&identify=76465a847fdaa342598bdaa438f2b50c23e3176d98d723ff25b3c942fd32ed320d5bfbd1ec2a2ffa
- 0.75  http://russiandreams.info/human-services-resume-objective.html/human-services-resume-objective-sample-objectives-for-entry-level-resumes-res
- 0.60  https://nick-zhang.weebly.com/octavia.html
- 0.60  https://clunygreyjewelry.com/index.html
- 0.60  http://telgenhoffandoetgen.com/
- 0.60  http://mailsdaddy.com/
- 0.60  http://devconpacific.com/
- 0.60  http://cbe-software.com/