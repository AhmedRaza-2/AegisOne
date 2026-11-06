# URL evaluation - reputation_v2

- legit_popular (n=498): false alarms WARN(>=35) 3.82%, BLOCK(>=60) 3.82%
- legit_web (n=2000): false alarms WARN(>=35) 8.40%, BLOCK(>=60) 7.00%
- openphish_fresh (n=300): recall WARN 80.7%, BLOCK 76.7%
  - final: AUC 0.927 | TPR@FPR 1% 15.0%, 0.1% 0.0% | AP@1% base rate 0.109
  - neural: AUC 0.855 | TPR@FPR 1% 46.3%, 0.1% 0.0% | AP@1% base rate 0.229
- mut_subdomain_injection (n=300): recall WARN 99.7%, BLOCK 99.7%
  - final: AUC 0.989 | TPR@FPR 1% 0.0%, 0.1% 0.0% | AP@1% base rate 0.206
  - neural: AUC 0.070 | TPR@FPR 1% 0.0%, 0.1% 0.0% | AP@1% base rate 0.005
- mut_path_padding (n=300): recall WARN 37.7%, BLOCK 35.7%
  - final: AUC 0.766 | TPR@FPR 1% 6.7%, 0.1% 0.0% | AP@1% base rate 0.041
  - neural: AUC 0.674 | TPR@FPR 1% 6.0%, 0.1% 0.0% | AP@1% base rate 0.025

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
- 1.00  http://cod4-server.info/?page=profile&identify=76465a847fdaa342598bdaa438f2b50c23e3176d98d723ff25b3c942fd32ed320d5bfbd1ec2a2ffa
- 1.00  http://9ofik.mico-vl.ru/dissertation/355ba2cb6c170105864b80d24cc60f1a
- 1.00  http://xugeuvi.cf/jyze/cryptocurrency-dataset-bybu.php
- 1.00  http://downloadmatrixeo.cf/forex-mmcis-ru-tournaments-472219.html
- 0.97  https://www.sagunpaudel.com.np/2016/01/
- 0.96  http://www.uninstallerfix.com/uninstall-errors/how-to-uninstall-quilters-39-polygons-template-pack-guide.html
- 0.96  https://www.live-production.tv/news/products/amv-upgrades-nyla-truck-riedel-artist-intercom.html
- 0.96  http://www.pmlive.com/tags/monoclonal_antibody_drugs