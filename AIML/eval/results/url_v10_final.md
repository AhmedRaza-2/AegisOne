# URL evaluation - v10_final

- legit_popular (n=498): false alarms WARN(>=35) 3.82%, BLOCK(>=60) 3.82%
- legit_web (n=2000): false alarms WARN(>=35) 5.15%, BLOCK(>=60) 4.80%
- openphish_fresh (n=300): recall WARN 93.0%, BLOCK 86.7%
  - final: AUC 0.960 | TPR@FPR 1% 15.7%, 0.1% 15.7% | AP@1% base rate 0.253
  - neural: AUC 0.872 | TPR@FPR 1% 60.3%, 0.1% 28.3% | AP@1% base rate 0.505
- mut_subdomain_injection (n=300): recall WARN 100.0%, BLOCK 100.0%
  - final: AUC 0.992 | TPR@FPR 1% 0.0%, 0.1% 0.0% | AP@1% base rate 0.221
  - neural: AUC 0.008 | TPR@FPR 1% 0.0%, 0.1% 0.0% | AP@1% base rate 0.005
- mut_path_padding (n=300): recall WARN 90.0%, BLOCK 84.3%
  - final: AUC 0.958 | TPR@FPR 1% 13.7%, 0.1% 13.7% | AP@1% base rate 0.230
  - neural: AUC 0.871 | TPR@FPR 1% 59.0%, 0.1% 29.3% | AP@1% base rate 0.503

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
- 0.96  https://livejapan.com/en/article-a0000074/?sc_lid=lj_pc_article_html_frame_5
- 0.96  https://www.livecareer.com/resume-search/r/certified-nursing-assistant-8abbc85d853e4ccb9be73d4f4b14d31d
- 0.96  http://www.uninstallerfix.com/uninstall-errors/how-to-uninstall-quilters-39-polygons-template-pack-guide.html
- 0.96  https://www.livecareer.com/resume-search/r/-9777bcc4441844e380db329d5ee3653c
- 0.96  http://www.livepassionately.net/2008/10/ego-could-be-defined-as-whatever-covers.html
- 0.96  https://www.live-production.tv/news/products/amv-upgrades-nyla-truck-riedel-artist-intercom.html
- 0.96  https://steamdiscovery.com/982370/steamgame/line-dance-virtual/
- 0.96  http://googleylessons.com/blog/irce2012/