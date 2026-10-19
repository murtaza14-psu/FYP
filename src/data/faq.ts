export interface FaqItem {
  question: string
  answer: string
}

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    question: 'What does this tool do?',
    answer:
      'You describe a GPU workload (task type, number of GPUs, duration and utilisation). The tool predicts the heat it will generate, estimates the water and electricity that air, direct-to-chip and immersion cooling would use to remove that heat, and ranks the options by what matters most to you.',
  },
  {
    question: 'Where does the heat prediction come from?',
    answer:
      'In this prototype the heat load is a fixed placeholder value (1.5 MW). The final system will use a machine-learning model trained on the MIT SuperCloud dataset, so the prediction will respond to your inputs.',
  },
  {
    question: 'Why is only Ashburn, Virginia available?',
    answer:
      'Water and electricity use depend heavily on local climate and the power grid. The prototype supports one region, Ashburn, Virginia, USA, which hosts one of the largest concentrations of data centres in the world. More regions, such as cities in Pakistan, are planned.',
  },
  {
    question: 'How are water and electricity calculated?',
    answer:
      'For now each technique uses a simple placeholder factor per kilowatt-hour of heat removed. The final system will replace these with physics-based equations that account for the local climate and cooling-system design.',
  },
  {
    question: 'What is the difference between the three cooling techniques?',
    answer:
      'Air cooling moves chilled air through the racks. Direct-to-chip cooling circulates liquid through cold plates attached to each GPU. Immersion cooling submerges servers in a dielectric fluid. Liquid-based approaches generally remove heat more efficiently, but cost and complexity differ.',
  },
  {
    question: 'How does the ranking work?',
    answer:
      'The prototype ranks by a single criterion you choose (water, electricity, or a balanced blend). The final system will use multi-criteria decision methods, AHP and TOPSIS, so you can weigh several criteria at once.',
  },
  {
    question: 'Are the results accurate?',
    answer:
      'No. This is a prototype: the heat prediction and cooling figures are placeholders that show how the final tool will look and behave. Do not use them for engineering or purchasing decisions.',
  },
  {
    question: 'Do I need an account, and is my data stored?',
    answer:
      'No account is needed. Your most recent result is kept only in your browser for the current session and is never sent to a server.',
  },
]
