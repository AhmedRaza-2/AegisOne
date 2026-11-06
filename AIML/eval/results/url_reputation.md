# URL evaluation - reputation

- legit_popular (n=498): false alarms WARN(>=35) 6.02%, BLOCK(>=60) 5.62%
- legit_web (n=2000): false alarms WARN(>=35) 8.40%, BLOCK(>=60) 7.00%
- openphish_fresh (n=300): recall WARN 81.0%, BLOCK 77.0%
  - final: AUC 0.924 | TPR@FPR 1% 15.0%, 0.1% 0.0% | AP@1% base rate 0.095
  - neural: AUC 0.855 | TPR@FPR 1% 46.3%, 0.1% 0.0% | AP@1% base rate 0.229
- mut_subdomain_injection (n=300): recall WARN 99.7%, BLOCK 99.7%
  - final: AUC 0.988 | TPR@FPR 1% 0.0%, 0.1% 0.0% | AP@1% base rate 0.193
  - neural: AUC 0.070 | TPR@FPR 1% 0.0%, 0.1% 0.0% | AP@1% base rate 0.005
- mut_path_padding (n=300): recall WARN 37.7%, BLOCK 35.7%
  - final: AUC 0.765 | TPR@FPR 1% 6.7%, 0.1% 0.0% | AP@1% base rate 0.037
  - neural: AUC 0.674 | TPR@FPR 1% 6.0%, 0.1% 0.0% | AP@1% base rate 0.025

Worst false positives (legit_popular):
- 1.00  https://www.snapchat.com/@%D8%A7%D8%A8%D9%88%D8%AA%D8%B1%D9%83%D9%8A?invite_id=-VqcwEFE&locale=ar_SA%40calendar%3Dgregorian&share_id=Wt-s9fx
- 1.00  https://mts.ru/personal/dlya-doma/checkconnect/all-mts?utm_source=cvm_perform%5Cu0026utm_medium%3Dyandex_karty%5Cu0026utm_campaign%3Dabs_shp
- 0.99  https://www.google.cn/about/careers/applications/apply/5293874772705280/form?src=website
- 0.97  https://www.google.cn/about/careers/applications/apply/5309425905565696/form?src=website
- 0.96  https://www.psx.com.pk/psx/events-psx/20-years-of-cfasp-celebrated-at-psx-with-a-gong-ceremony
- 0.96  https://www.olx.com.pk/90-chitti-road_g8828/cars_c84?filter=color_eq_15%2Cregistration_city_eq_lahore
- 0.96  https://www.psx.com.pk/blog/index.php/2021/11/11/nit-pakistan-gateway-index-a-performance-analysis-since-launch/
- 0.96  https://www.olx.com.pk/7th-avenue_g5000901/other-jobs_c65

Worst false positives (legit_web):
- 1.00  http://cod4-server.info/?page=profile&identify=76465a847fdaa342598bdaa438f2b50c23e3176d98d723ff25b3c942fd32ed320d5bfbd1ec2a2ffa
- 1.00  http://9ofik.mico-vl.ru/dissertation/355ba2cb6c170105864b80d24cc60f1a
- 1.00  http://xugeuvi.cf/jyze/cryptocurrency-dataset-bybu.php
- 1.00  http://downloadmatrixeo.cf/forex-mmcis-ru-tournaments-472219.html
- 0.97  https://www.sagunpaudel.com.np/2016/01/
- 0.96  http://www.uninstallerfix.com/uninstall-errors/how-to-uninstall-quilters-39-polygons-template-pack-guide.html
- 0.96  https://www.live-production.tv/news/products/amv-upgrades-nyla-truck-riedel-artist-intercom.html
- 0.96  http://www.pmlive.com/tags/monoclonal_antibody_drugs