# URL evaluation - before

- legit_popular (n=498): false alarms WARN(>=35) 31.73%, BLOCK(>=60) 29.32%
- legit_web (n=2000): false alarms WARN(>=35) 9.25%, BLOCK(>=60) 7.55%
- openphish_fresh (n=300): recall WARN 84.3%, BLOCK 80.3%
  - final: AUC 0.901 | TPR@FPR 1% 14.0%, 0.1% 0.0% | AP@1% base rate 0.053
  - neural: AUC 0.855 | TPR@FPR 1% 46.3%, 0.1% 0.0% | AP@1% base rate 0.229
- mut_subdomain_injection (n=300): recall WARN 99.7%, BLOCK 99.7%
  - final: AUC 0.979 | TPR@FPR 1% 0.0%, 0.1% 0.0% | AP@1% base rate 0.142
  - neural: AUC 0.070 | TPR@FPR 1% 0.0%, 0.1% 0.0% | AP@1% base rate 0.005
- mut_path_padding (n=300): recall WARN 37.7%, BLOCK 35.7%
  - final: AUC 0.754 | TPR@FPR 1% 6.7%, 0.1% 0.0% | AP@1% base rate 0.025
  - neural: AUC 0.674 | TPR@FPR 1% 6.0%, 0.1% 0.0% | AP@1% base rate 0.025

Worst false positives (legit_popular):
- 1.00  https://www.afternic.com/account/payments?app=www&plid=497036&prog_id=AfterNIC&realm=idp&path=%2Flease-to-own
- 1.00  https://www.snapchat.com/@%D8%A7%D8%A8%D9%88%D8%AA%D8%B1%D9%83%D9%8A?invite_id=-VqcwEFE&locale=ar_SA%40calendar%3Dgregorian&share_id=Wt-s9fx
- 1.00  https://www.go.com/?sv=IS&lk=&ak=ISHP&rl=LINK_T00004_HTML_Direct_&rd=http:%252F%252Fwww.microsoft.com%252Fie%252Fdownload%252F
- 1.00  https://www.afternic.com/account/payments?app=www&path=%2Fsecurity%2Fverification-methods%3Fas_code%3D1&plid=497036&prog_id=AfterNIC&realm=i
- 1.00  https://www.afternic.com/account/profile?realm=idp&app=afternic-v2&subdomain=www&path=%2Fdomains%2Fadd%2Fdone%3Fshow_drid%3Dtrue
- 1.00  https://www.t-online.de/auth/login-button/?logoutReturnToUrl=https%3A%2F%2Fmuenchen.t-online.de%2Fregion%2Fmuenchen%2Fid_100382158%2Fpublic-
- 1.00  https://shopify.com/1186758756/account/orders/8126c9bda504df65ac55d97af1ad1eba?buyer_token_attempted=1&locale=en-US&shop_pay_order=true
- 1.00  https://shopify.com/13641331/account/orders/4050b6db01b098bd6917c6a9a14e37b7?buyer_token_attempted=1&locale=en-US

Worst false positives (legit_web):
- 1.00  http://cod4-server.info/?page=profile&identify=76465a847fdaa342598bdaa438f2b50c23e3176d98d723ff25b3c942fd32ed320d5bfbd1ec2a2ffa
- 1.00  http://9ofik.mico-vl.ru/dissertation/355ba2cb6c170105864b80d24cc60f1a
- 1.00  http://xugeuvi.cf/jyze/cryptocurrency-dataset-bybu.php
- 1.00  http://downloadmatrixeo.cf/forex-mmcis-ru-tournaments-472219.html
- 1.00  http://geeksquad.fixya.com/support/t8744567-account_change_ido
- 0.99  https://sju.teamdynamix.com/TDClient/Requests/ServiceDet?ID=26767
- 0.97  https://www.sagunpaudel.com.np/2016/01/
- 0.96  http://www.uninstallerfix.com/uninstall-errors/how-to-uninstall-quilters-39-polygons-template-pack-guide.html