# URL evaluation - v10_ensemble

- legit_popular (n=498): false alarms WARN(>=35) 3.82%, BLOCK(>=60) 3.82%
- legit_web (n=2000): false alarms WARN(>=35) 4.80%, BLOCK(>=60) 4.40%
- openphish_fresh (n=300): recall WARN 87.0%, BLOCK 79.0%
  - final: AUC 0.954 | TPR@FPR 1% 14.3%, 0.1% 14.3% | AP@1% base rate 0.238
  - neural: AUC 0.873 | TPR@FPR 1% 57.3%, 0.1% 25.3% | AP@1% base rate 0.484
- mut_subdomain_injection (n=300): recall WARN 100.0%, BLOCK 100.0%
  - final: AUC 0.992 | TPR@FPR 1% 0.0%, 0.1% 0.0% | AP@1% base rate 0.225
  - neural: AUC 0.008 | TPR@FPR 1% 0.0%, 0.1% 0.0% | AP@1% base rate 0.005
- mut_path_padding (n=300): recall WARN 46.0%, BLOCK 37.7%
  - final: AUC 0.885 | TPR@FPR 1% 6.7%, 0.1% 6.7% | AP@1% base rate 0.120
  - neural: AUC 0.809 | TPR@FPR 1% 19.7%, 0.1% 5.7% | AP@1% base rate 0.122

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
- 0.96  https://www.livelaughdecorate.com/2013/07/chairs-on-wheels-lets-slide-shall-we.html
- 0.96  https://steamdiscovery.com/982370/steamgame/line-dance-virtual/
- 0.96  https://docs.citrix.com/en-us/netscaler/12/clustering/cluster-overview/cluster-config-sync-concepts.html
- 0.96  http://googleylessons.com/blog/irce2012/
- 0.96  https://businessfinder.oregonlive.com/duvall-a-l-dvm-valley-veterinary-clinic-rainier-or.html
- 0.96  http://www.livepassionately.net/2008/10/ego-could-be-defined-as-whatever-covers.html
- 0.96  https://www.live-production.tv/news/products/amv-upgrades-nyla-truck-riedel-artist-intercom.html
- 0.96  https://www.livecareer.com/resume-search/r/certified-nursing-assistant-8abbc85d853e4ccb9be73d4f4b14d31d