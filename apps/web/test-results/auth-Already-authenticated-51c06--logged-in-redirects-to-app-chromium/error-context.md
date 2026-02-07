# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - button "Switch language" [ref=e4] [cursor=pointer]:
      - img [ref=e5]
      - text: تونسي
    - generic [ref=e10]:
      - generic [ref=e11]:
        - generic [ref=e12]: O
        - heading "Connectez-vous à OMNIA" [level=1] [ref=e13]
        - paragraph [ref=e14]: Suivi des opérations de terrain
      - generic [ref=e15]:
        - generic [ref=e16]:
          - generic [ref=e17]: Email
          - textbox "Email" [ref=e19]:
            - /placeholder: sara@omnia.org
            - text: admin@omnia.org
        - generic [ref=e20]:
          - generic [ref=e21]: Mot de passe
          - textbox "Mot de passe" [ref=e23]:
            - /placeholder: ••••••••
            - text: dev12345
        - alert [ref=e24]: Email ou mot de passe incorrect
        - button "Se connecter" [ref=e25] [cursor=pointer]:
          - img [ref=e27]
          - text: Se connecter
        - paragraph [ref=e30]: "Demo : sara@omnia.org / admin@omnia.org (mot de passe : dev12345)"
  - button "Open Next.js Dev Tools" [ref=e36] [cursor=pointer]:
    - img [ref=e37]
  - alert [ref=e40]
```