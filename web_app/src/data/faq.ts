export interface FaqItem {
  question: string
  answer: string
}

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    question: 'What does this tool do?',
    answer:
      'You describe a GPU fleet (number of GPUs, SM and memory utilisation, hours per day and days per year). The tool predicts the heat it gives off in a year, estimates the water and electricity that air cooling and direct-to-chip cooling would use to remove that heat in Ashburn, Virginia, and ranks the two options by what matters most to you.',
  },
  {
    question: 'Where does the heat prediction come from?',
    answer:
      'Five machine-learning models (ridge regression, random forest, gradient boosting, support vector regression and a neural network) trained on the MIT SuperCloud dataset each estimate the power of one GPU from its utilisation. Their average, times your GPU count and running time, gives the annual heat. The models need the local prediction service (python ml_module/api.py) to be running.',
  },
  {
    question: 'Why is only Ashburn, Virginia available?',
    answer:
      'Water and electricity use depend heavily on local climate and the power grid. The prototype supports one region, Ashburn, Virginia, USA, which hosts one of the largest concentrations of data centres in the world. More regions, such as cities in Pakistan, are planned.',
  },
  {
    question: 'How are water and electricity calculated?',
    answer:
      'Hour by hour over a typical year of Ashburn weather (Washington Dulles airport, 2011 to 2025), using the equations in the project’s Cooling Equations Summary. Air cooling adds up the air-handler fans, chillers, pumps and cooling-tower fans, plus the water the towers evaporate. Direct-to-chip cooling adds up the coolant and building-water pumps, the dry coolers, a small chiller and tower used only in hot weather, and the small air system that removes the heat the cold plates miss. Water is evaporation plus drift plus blowdown (4 cycles of concentration are assumed). The results are shown as a typical value with a low to high range.',
  },
  {
    question: 'What is the difference between the two cooling techniques?',
    answer:
      'Air cooling moves chilled air through the racks and rejects the heat in cooling towers. Direct-to-chip cooling circulates liquid through cold plates attached to each GPU and rejects most of the heat through dry coolers, which use no water. Immersion cooling, which submerges servers in a dielectric fluid, is not modelled yet.',
  },
  {
    question: 'How does the ranking work?',
    answer:
      'The prototype ranks by a single criterion you choose (water, electricity, or a balanced blend). The final system will use multi-criteria decision methods, AHP and TOPSIS, so you can weigh several criteria at once.',
  },
  {
    question: 'Are the results accurate?',
    answer:
      'The heat prediction was tested on GPU users the models had never seen (R² about 0.92, average error about 8 W per GPU) but it covers GPU power only and was trained on V100 data. The cooling model follows the project’s equations for one typical weather year in Ashburn and cools GPU heat only (not CPUs, networking or storage), so treat the results as estimates and not as engineering or purchasing advice.',
  },
  {
    question: 'Do I need an account, and is my data stored?',
    answer:
      'No account is needed. Your most recent result is kept only in your browser for the current session and is never sent to a server.',
  },
]
