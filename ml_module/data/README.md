# Trace Description

This repository contains a sample of the data used for the HPCA '22 paper **Enabling Workloads on Large-Scale GPU Accelerated System: Characterization,Opportunities, and Implications.** 

Data collection methodology and additional details can be found here : https://dcc.mit.edu 

# Terms of use
By downloading this data, you agree to the following :

* You acknowledge that this dataset is a subset of all the workloads that ran on the system described and as such, is not apporpriate for use in
  estimating system utilization or any other characteristics beyond those outlined in the HPCA'22 paper above.
* This dataset can only be used to perform the analysis outlined in the HPCA'22 paper.
* This data will not be used to extrapolate and draw broader conclusions on any aspects of the system beyond that oulined in our HPCA'22 paper. 

## Files
*dcgm.csv*: This file contains the GPU utilization information for each GPU assigned to each job, including power consumption, resource usage.

*scheduler_data.csv*:  This file contains the scheduler-level information about each job id, including start/end/wait time, user id, job type. 

*nvidia_smi.csv*: This file contains the time-series information captured by nvidia-smi, for about 2000 jobs. Data is recorded every 100ms.

## Questions
For questions about the paper and the data, please email <li.baol@northeastern.edu>

### Acknowledgement
Research was sponsored by the United States Air Force Research Laboratory and the United States Air Force Artificial Intelligence Accelerator and was accomplished under Cooperative Agreement Number FA8750-19-2-1000. The views and conclusions contained in this document are those of the authors and should not be interpreted as representing the official policies, either expressed or implied, of the United States Air Force or the U.S. Government. The U.S. Government is authorized to reproduce and distribute reprints for Government purposes notwithstanding any copyright notation herein.
