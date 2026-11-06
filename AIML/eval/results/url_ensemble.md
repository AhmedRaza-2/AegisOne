# URL evaluation - url_ensemble

- legit_popular (n=498): false alarms WARN(>=35) 3.82%, BLOCK(>=60) 3.82%
- legit_web (n=2000): false alarms WARN(>=35) 8.10%, BLOCK(>=60) 5.90%
- openphish_fresh (n=300): recall WARN 88.0%, BLOCK 81.3%
  - final: AUC 0.943 | TPR@FPR 1% 14.3%, 0.1% 14.3% | AP@1% base rate 0.141
  - neural: AUC 0.853 | TPR@FPR 1% 45.7%, 0.1% 0.0% | AP@1% base rate 0.234
- mut_subdomain_injection (n=300): recall WARN 100.0%, BLOCK 100.0%
  - final: AUC 0.991 | TPR@FPR 1% 0.0%, 0.1% 0.0% | AP@1% base rate 0.214
  - neural: AUC 0.008 | TPR@FPR 1% 0.0%, 0.1% 0.0% | AP@1% base rate 0.005
- mut_path_padding (n=300): recall WARN 47.0%, BLOCK 37.7%
  - final: AUC 0.858 | TPR@FPR 1% 6.7%, 0.1% 6.7% | AP@1% base rate 0.062
  - neural: AUC 0.764 | TPR@FPR 1% 6.7%, 0.1% 0.0% | AP@1% base rate 0.036

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
- 1.00  http://cod4-server.info/?page=profile&identify=76465a847fdaa342598bdaa438f2b50c23e3176d98d723ff25b3c942fd32ed320d5bfbd1ec2a2ffa
- 0.97  http://9ofik.mico-vl.ru/dissertation/355ba2cb6c170105864b80d24cc60f1a
- 0.96  http://100resilientcities.org/why-rebuild-by-design-succeeds/
- 0.96  http://www.livepassionately.net/2008/10/ego-could-be-defined-as-whatever-covers.html
- 0.96  https://www.live-production.tv/news/products/amv-upgrades-nyla-truck-riedel-artist-intercom.html
- 0.96  https://thevinchaser.com/bdc-helper
- 0.96  https://livejapan.com/en/article-a0000074/?sc_lid=lj_pc_article_html_frame_5