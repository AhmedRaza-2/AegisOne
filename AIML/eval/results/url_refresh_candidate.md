# URL evaluation - refresh_candidate

- legit_popular (n=498): false alarms WARN(>=35) 3.82%, BLOCK(>=60) 3.82%
- legit_web (n=2000): false alarms WARN(>=35) 7.00%, BLOCK(>=60) 6.15%
- openphish_fresh (n=300): recall WARN 82.7%, BLOCK 78.7%
  - final: AUC 0.934 | TPR@FPR 1% 15.0%, 0.1% 0.0% | AP@1% base rate 0.111
  - neural: AUC 0.882 | TPR@FPR 1% 49.7%, 0.1% 0.0% | AP@1% base rate 0.256
- mut_subdomain_injection (n=300): recall WARN 99.7%, BLOCK 99.7%
  - final: AUC 0.990 | TPR@FPR 1% 0.0%, 0.1% 0.0% | AP@1% base rate 0.206
  - neural: AUC 0.204 | TPR@FPR 1% 0.0%, 0.1% 0.0% | AP@1% base rate 0.005
- mut_path_padding (n=300): recall WARN 71.3%, BLOCK 66.3%
  - final: AUC 0.927 | TPR@FPR 1% 10.0%, 0.1% 0.0% | AP@1% base rate 0.083
  - neural: AUC 0.872 | TPR@FPR 1% 25.0%, 0.1% 0.0% | AP@1% base rate 0.121

Worst false positives (legit_popular):
- 0.96  https://www.olx.com.pk/90-chitti-road_g8828/cars_c84?filter=color_eq_15%2Cregistration_city_eq_lahore
- 0.96  https://www.olx.com.pk/7th-avenue_g5000901/other-jobs_c65
- 0.96  https://www.psx.com.pk/blog/index.php/2021/11/11/nit-pakistan-gateway-index-a-performance-analysis-since-launch/
- 0.96  https://www.olx.com.pk/100-quarters_g5000084/bikes-sports-heavy-bikes_c707034
- 0.96  https://www.psx.com.pk/blog/index.php/tag/nit-etf/
- 0.96  https://www.psx.com.pk/psx/events-psx/20-years-of-cfasp-celebrated-at-psx-with-a-gong-ceremony
- 0.96  https://chasevalue.pk/collections/beauty-personal-care-beauty-tools/products/beauty-pouch-blue-chase-value-a138645-a-blue-257790
- 0.96  https://www.olx.com.pk/204-chak-road_g9511/catering-restaurant_c2047/q-catering

Worst false positives (legit_web):
- 1.00  http://xugeuvi.cf/jyze/cryptocurrency-dataset-bybu.php
- 1.00  http://wu-taichi.info/?page_id=48726
- 1.00  http://downloadmatrixeo.cf/forex-mmcis-ru-tournaments-472219.html
- 1.00  http://cod4-server.info/?page=profile&identify=76465a847fdaa342598bdaa438f2b50c23e3176d98d723ff25b3c942fd32ed320d5bfbd1ec2a2ffa
- 1.00  http://9ofik.mico-vl.ru/dissertation/355ba2cb6c170105864b80d24cc60f1a
- 0.96  https://www.livelaughdecorate.com/2013/07/chairs-on-wheels-lets-slide-shall-we.html
- 0.96  https://flowerdeliveryaustralia.net/online-florist/spring-gully
- 0.96  http://100resilientcities.org/why-rebuild-by-design-succeeds/