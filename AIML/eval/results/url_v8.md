# URL evaluation - v8

- legit_popular (n=498): false alarms WARN(>=35) 3.82%, BLOCK(>=60) 3.82%
- legit_web (n=2000): false alarms WARN(>=35) 15.25%, BLOCK(>=60) 13.25%
- openphish_fresh (n=300): recall WARN 93.7%, BLOCK 91.3%
  - final: AUC 0.926 | TPR@FPR 1% 16.3%, 0.1% 0.0% | AP@1% base rate 0.079
  - neural: AUC 0.802 | TPR@FPR 1% 5.0%, 0.1% 0.0% | AP@1% base rate 0.046
- mut_subdomain_injection (n=300): recall WARN 100.0%, BLOCK 100.0%
  - final: AUC 0.987 | TPR@FPR 1% 0.0%, 0.1% 0.0% | AP@1% base rate 0.185
  - neural: AUC 0.008 | TPR@FPR 1% 0.0%, 0.1% 0.0% | AP@1% base rate 0.005
- mut_path_padding (n=300): recall WARN 100.0%, BLOCK 100.0%
  - final: AUC 0.941 | TPR@FPR 1% 18.7%, 0.1% 0.0% | AP@1% base rate 0.089
  - neural: AUC 0.867 | TPR@FPR 1% 1.0%, 0.1% 0.0% | AP@1% base rate 0.102

Worst false positives (legit_popular):
- 1.00  https://www.opendns.com:443/?ref=besttechie.com
- 0.96  https://www.olx.com.pk/90-chitti-road_g8828/cars_c84?filter=color_eq_15%2Cregistration_city_eq_lahore
- 0.96  https://www.psx.com.pk/blog/index.php/2021/11/11/nit-pakistan-gateway-index-a-performance-analysis-since-launch/
- 0.96  https://www.olx.com.pk/7th-avenue_g5000901/other-jobs_c65
- 0.96  https://www.psx.com.pk/blog/index.php/tag/nit-etf/
- 0.96  https://www.psx.com.pk/psx/events-psx/20-years-of-cfasp-celebrated-at-psx-with-a-gong-ceremony
- 0.96  https://chasevalue.pk/collections/beauty-personal-care-beauty-tools/products/beauty-pouch-blue-chase-value-a138645-a-blue-257790
- 0.96  https://www.olx.com.pk/100-quarters_g5000084/bikes-sports-heavy-bikes_c707034

Worst false positives (legit_web):
- 1.00  http://buildipedia.com/at-home/design-remodeling/the-home-office-a-balance-of-function-and-personal-style?print=1&amp;tmpl=component
- 1.00  http://wu-taichi.info/?page_id=48726
- 1.00  https://secure.tct.tv/EmailaFriend.asp?ProductCode=10COMREPandShawl
- 1.00  http://thedysfunctionalangel.ml/936/gopinic-2724.php
- 1.00  http://theloo.info/news.php?action=show&id=37887
- 1.00  https://coauthoryourlifewithgod.com/2016/01/20/checklists-for-discerning-our-vocation/?shared=email&msg=fail
- 1.00  https://www.harringtonbooks.co.uk/advSearchResults.php?authorField=OTTO+NUCKEL&action=search
- 1.00  http://cod4-server.info/?page=profile&identify=76465a847fdaa342598bdaa438f2b50c23e3176d98d723ff25b3c942fd32ed320d5bfbd1ec2a2ffa